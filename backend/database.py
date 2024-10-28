from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, String, Text, text, CheckConstraint, select, event
from datetime import datetime
import os
from typing import List, AsyncGenerator
import shutil
from pathlib import Path
import json
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

# START MIGATION SCRIPT
async def migrate_database():
    """Recreate tables with new schema while preserving data"""
    logger.info("Starting database migration")
    
    async with engine.begin() as conn:
        try:
            # First backup existing data
            eval_data = await conn.execute(text("SELECT * FROM evaluations"))
            evaluations = eval_data.fetchall()
            
            result_data = await conn.execute(text("SELECT * FROM evaluation_results"))
            eval_results = result_data.fetchall()
            
            # Drop existing tables
            await conn.execute(text("DROP TABLE IF EXISTS evaluation_results"))
            await conn.execute(text("DROP TABLE IF EXISTS evaluations"))
            
            # Create new tables with updated schema
            await conn.execute(text("""
                CREATE TABLE evaluations (
                    id INTEGER NOT NULL PRIMARY KEY,
                    evaluation_type_id INTEGER NOT NULL,
                    timestamp DATETIME NOT NULL,
                    system_prompt TEXT NOT NULL,
                    model_name VARCHAR NOT NULL,
                    total_tokens INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY(evaluation_type_id) REFERENCES evaluation_types (id)
                )
            """))
            
            await conn.execute(text("""
                CREATE TABLE evaluation_results (
                    id INTEGER NOT NULL PRIMARY KEY,
                    evaluation_id INTEGER NOT NULL,
                    test_case_id INTEGER NOT NULL,
                    output TEXT NOT NULL,
                    result VARCHAR NOT NULL,
                    explanation TEXT,
                    prompt_tokens INTEGER NOT NULL DEFAULT 0,
                    response_tokens INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY(evaluation_id) REFERENCES evaluations (id),
                    FOREIGN KEY(test_case_id) REFERENCES test_cases (id),
                    CONSTRAINT valid_result CHECK (result IN ('pass', 'fail'))
                )
            """))
            
            # Restore evaluations data
            for eval in evaluations:
                await conn.execute(
                    text("""
                        INSERT INTO evaluations (id, evaluation_type_id, timestamp, system_prompt, model_name)
                        VALUES (:id, :type_id, :timestamp, :prompt, :model)
                    """),
                    {
                        "id": eval[0],
                        "type_id": eval[1],
                        "timestamp": eval[2],
                        "prompt": eval[3],
                        "model": eval[4]
                    }
                )
            
            # Restore evaluation results data
            for result in eval_results:
                await conn.execute(
                    text("""
                        INSERT INTO evaluation_results (id, evaluation_id, test_case_id, output, result, explanation)
                        VALUES (:id, :eval_id, :case_id, :output, :result, :explanation)
                    """),
                    {
                        "id": result[0],
                        "eval_id": result[1],
                        "case_id": result[2],
                        "output": result[3],
                        "result": result[4],
                        "explanation": result[5]
                    }
                )
            
            logger.info("Database migration completed successfully")
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise DatabaseConnectionError(f"Migration failed: {str(e)}") from e
# END MIGRATION SCRIPT


DATABASE_URL = f"sqlite+aiosqlite:///{os.path.join(os.path.dirname(__file__), '..', 'data', 'llm_eval.db')}"

class DatabaseConnectionError(Exception):
    pass

def snake_to_title_case(text: str) -> str:
    return ' '.join(word.capitalize() for word in text.split('_'))

class Base(DeclarativeBase):
    pass

class EvaluationType(Base):
    __tablename__ = "evaluation_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    criteria: Mapped[List["Criterion"]] = relationship(back_populates="evaluation_type", cascade="all, delete-orphan")
    test_cases: Mapped[List["TestCase"]] = relationship(back_populates="evaluation_type", cascade="all, delete-orphan")
    evaluations: Mapped[List["Evaluation"]] = relationship(back_populates="evaluation_type", cascade="all, delete-orphan")

class Criterion(Base):
    __tablename__ = "criteria"
    id: Mapped[int] = mapped_column(primary_key=True)
    evaluation_type_id: Mapped[int] = mapped_column(ForeignKey("evaluation_types.id"))
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    evaluation_type: Mapped[EvaluationType] = relationship(back_populates="criteria")
    test_cases: Mapped[List["TestCase"]] = relationship(back_populates="criterion")
    __table_args__ = (CheckConstraint('name != ""', name="name_not_empty"),)

class TestCase(Base):
    __tablename__ = "test_cases"
    id: Mapped[int] = mapped_column(primary_key=True)
    evaluation_type_id: Mapped[int] = mapped_column(ForeignKey("evaluation_types.id"))
    criterion_id: Mapped[int] = mapped_column(ForeignKey("criteria.id"))
    input: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    evaluation_type: Mapped[EvaluationType] = relationship(back_populates="test_cases")
    criterion: Mapped[Criterion] = relationship(back_populates="test_cases")
    evaluation_results: Mapped[List["EvaluationResult"]] = relationship(back_populates="test_case")

class Evaluation(Base):
    __tablename__ = "evaluations"
    id: Mapped[int] = mapped_column(primary_key=True)
    evaluation_type_id: Mapped[int] = mapped_column(ForeignKey("evaluation_types.id"))
    timestamp: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    system_prompt: Mapped[str] = mapped_column(Text)
    model_name: Mapped[str] = mapped_column(String)
    total_tokens: Mapped[int] = mapped_column(default=0)  # Added field
    evaluation_type: Mapped[EvaluationType] = relationship(back_populates="evaluations")
    results: Mapped[List["EvaluationResult"]] = relationship(back_populates="evaluation", cascade="all, delete-orphan")

class EvaluationResult(Base):
    __tablename__ = "evaluation_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    evaluation_id: Mapped[int] = mapped_column(ForeignKey("evaluations.id"))
    test_case_id: Mapped[int] = mapped_column(ForeignKey("test_cases.id"))
    output: Mapped[str] = mapped_column(Text)
    result: Mapped[str] = mapped_column(String)
    explanation: Mapped[str] = mapped_column(Text, nullable=True)
    prompt_tokens: Mapped[int] = mapped_column(default=0)  # Added field
    response_tokens: Mapped[int] = mapped_column(default=0)  # Added field
    evaluation: Mapped[Evaluation] = relationship(back_populates="results")
    test_case: Mapped[TestCase] = relationship(back_populates="evaluation_results")
    __table_args__ = (CheckConstraint("result IN ('pass', 'fail')", name="valid_result"),)

engine = create_async_engine(DATABASE_URL)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

@asynccontextmanager
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    session = async_session_maker()
    try:
        yield session
        await session.commit()
    except Exception as e:
        await session.rollback()
        logger.error(f"Session error: {str(e)}")
        raise DatabaseConnectionError(f"Database error: {str(e)}") from e
    finally:
        await session.close()

async def init_db():
    logger.info("Initializing database tables")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created successfully")

async def backup_database():
    db_path = Path(DATABASE_URL.replace('sqlite+aiosqlite:///', ''))
    if db_path.exists():
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = db_path.parent / f"llm_eval_backup_{timestamp}.db"
        shutil.copy2(db_path, backup_path)
        logger.info(f"Created database backup: {backup_path}")
        return backup_path
    logger.warning("No database file found to backup")
    return None

async def init_speech_to_text_eval():
    logger.info("Initializing speech-to-text evaluation")
    async with async_session_maker() as session:
        eval_type = EvaluationType(
            name="speech_to_text",
            description="Evaluation of speech-to-text transcription optimization"
        )
        session.add(eval_type)
        await session.flush()
        
        test_cases_path = Path(__file__).parent / "evaluation_test_cases.json"
        with open(test_cases_path) as f:
            test_data = json.load(f)
        
        criteria_map = {}
        unique_criteria = {case["criterion"] for case in test_data["test_cases"]}
        
        for criterion_name in unique_criteria:
            criterion = Criterion(
                evaluation_type_id=eval_type.id,
                name=criterion_name,
                description=snake_to_title_case(criterion_name)
            )
            session.add(criterion)
            await session.flush()
            criteria_map[criterion_name] = criterion
            logger.info(f"Created criterion: {criterion_name}")
        
        for case in test_data["test_cases"]:
            test_case = TestCase(
                evaluation_type_id=eval_type.id,
                criterion_id=criteria_map[case["criterion"]].id,
                input=case["input"],
                description=case["description"]
            )
            session.add(test_case)
        
        await session.commit()
        logger.info("Speech-to-text evaluation initialized successfully")

async def verify_database():
    logger.info("Verifying database")
    db_path = Path(DATABASE_URL.replace('sqlite+aiosqlite:///', ''))
    needs_migration = False

    if not db_path.exists():
        logger.info("Database file not found, creating new database")
        await init_db()
        await init_speech_to_text_eval()
        logger.info("Initialized new database with speech-to-text evaluation")
    else:
        logger.info("Existing database found, creating backup")
        await backup_database()
        needs_migration = True  # Existing database needs migration
        
    try:
        if needs_migration:
            logger.info("Starting database migration...")
            await migrate_database()
            logger.info("Database migration completed")
        
        async with async_session_maker() as session:
            result = await session.execute(select(EvaluationType))
            if not result.scalars().first():
                logger.info("No evaluation types found, initializing speech-to-text evaluation")
                await init_speech_to_text_eval()
            else:
                logger.info("Database verification completed successfully")
    except Exception as e:
        logger.error(f"Database verification failed: {e}")
        raise DatabaseConnectionError(f"Database verification failed: {str(e)}") from e