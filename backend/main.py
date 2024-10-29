from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import os
import json
from datetime import datetime
from openai import OpenAI
import logging
import asyncio
from typing import List, Dict, Any, Set
import weakref
import tiktoken

from database import (
    get_async_session, 
    EvaluationType, 
    Criterion, 
    TestCase, 
    Evaluation, 
    EvaluationResult,
    verify_database,
    snake_to_title_case,
    DatabaseConnectionError
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

repo_config_path = os.path.join(os.path.dirname(__file__), "..", "config.json")
with open(repo_config_path, "r") as config_file:
    repo_config = json.load(config_file)

origins = [
    f"http://localhost:{repo_config['frontend']['port']}",
    "http://localhost:3004",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

config_path = os.path.join(os.path.dirname(__file__), "backend_config.json")
with open(config_path, "r") as config_file:
    config = json.load(config_file)
EVALUATION_MODEL = config.get("evaluation_model", "gpt-4o-mini")
SCORING_MODEL = config.get("scoring_model", "gpt-4o-mini")

class SystemPrompt(BaseModel):
    prompt: str

class TestCaseQuery(BaseModel):
    evaluation_id: int
    test_case_id: int
    criterion: str

class ConnectionManager:
    def __init__(self):
        self._active_connections: Set[WebSocket] = set()
        self._connection_tasks: Dict[WebSocket, asyncio.Task] = {}
        self._heartbeat_interval = 30
        
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self._active_connections.add(websocket)
        self._connection_tasks[websocket] = asyncio.create_task(self._heartbeat(websocket))
        
    def disconnect(self, websocket: WebSocket):
        self._active_connections.discard(websocket)
        if websocket in self._connection_tasks:
            self._connection_tasks[websocket].cancel()
            del self._connection_tasks[websocket]
        
    async def _heartbeat(self, websocket: WebSocket):
        try:
            while True:
                await asyncio.sleep(self._heartbeat_interval)
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    self.disconnect(websocket)
                    break
        except asyncio.CancelledError:
            pass
            
    async def broadcast(self, message: Dict[str, Any]):
        disconnect_ws = set()
        for websocket in self._active_connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to websocket: {e}")
                disconnect_ws.add(websocket)
        
        for ws in disconnect_ws:
            self.disconnect(ws)
            
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)

manager = ConnectionManager()

async def analyze_test_cases(session: Any) -> dict:
    for _ in range(3):
        try:
            stmt = (
                select(TestCase)
                .options(selectinload(TestCase.criterion))
                .join(Criterion)
                .join(EvaluationType)
                .where(EvaluationType.name == "speech_to_text")
            )
            
            result = await session.execute(stmt)
            test_cases = result.scalars().all()
            
            criteria_counts = {}
            for case in test_cases:
                criterion_name = case.criterion.name
                if criterion_name not in criteria_counts:
                    criteria_counts[criterion_name] = 0
                criteria_counts[criterion_name] += 1
            
            data = {
                "criteria": {k: snake_to_title_case(k) for k in criteria_counts.keys()},
                "counts_per_criterion": criteria_counts,
                "total_test_cases": len(test_cases)
            }
            
            return data
            
        except Exception as e:
            logger.error(f"Error analyzing test cases: {e}", exc_info=True)
            if _ == 2:
                raise HTTPException(status_code=500, detail=str(e))
            await asyncio.sleep(1)

@app.get("/test-case-details/{evaluation_id}/{test_case_id}")
async def get_test_case_details(evaluation_id: int, test_case_id: int):
    async with get_async_session() as session:
        try:
            # First get the test case information
            test_case = await session.execute(
                select(TestCase)
                .options(selectinload(TestCase.criterion))
                .where(TestCase.id == test_case_id)
            )
            test_case = test_case.scalar_one_or_none()
            
            if not test_case:
                raise HTTPException(status_code=404, detail="Test case not found")
            
            # Get the evaluation and result with a single query
            stmt = (
                select(EvaluationResult)
                .options(selectinload(EvaluationResult.evaluation))
                .where(
                    EvaluationResult.evaluation_id == evaluation_id,
                    EvaluationResult.test_case_id == test_case_id
                )
            )
            result = await session.execute(stmt)
            eval_result = result.scalar_one_or_none()
            
            if not eval_result:
                raise HTTPException(status_code=404, detail="Evaluation result not found")
            
            # Return complete details including models
            return {
                "id": test_case_id,
                "criterion": test_case.criterion.name,
                "input": test_case.input,
                "description": test_case.description,
                "output": eval_result.output,
                "result": eval_result.result,
                "explanation": eval_result.explanation,
                "prompt_tokens": eval_result.prompt_tokens,
                "response_tokens": eval_result.response_tokens,
                "input_model": eval_result.evaluation.model_name,
                "output_model": SCORING_MODEL
            }
            
        except HTTPException as e:
            raise e
        except Exception as e:
            logger.error(f"Error fetching test case details: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            try:
                data = await websocket.receive_text()
                await manager.send_personal_message({"message": f"Received: {data}"}, websocket)
            except WebSocketDisconnect:
                manager.disconnect(websocket)
                break
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                break
    finally:
        manager.disconnect(websocket)

@app.get("/config")
async def get_config():
    return {
        "backendPort": repo_config["backend"]["port"],
        "model": config["evaluation_model"],
        "scoringModel": config["scoring_model"]
    }

@app.get("/evaluation-settings")
async def get_evaluation_settings():
    return config["evaluation_settings"]

@app.get("/test-case-analysis")
async def get_test_case_analysis():
    async with get_async_session() as session:
        try:
            return await analyze_test_cases(session)
        except Exception as e:
            logger.error(f"Error in test case analysis: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

async def evaluate_output(input_text: str, output_text: str, criterion: str, description: str):
    for _ in range(3):
        try:
            settings = config["evaluation_settings"]
            evaluation_prompt = settings["evaluation_prompt_template"].format(
                input=input_text,
                output=output_text,
                criterion=criterion,
                description=description
            )

            response = await asyncio.to_thread(
                client.chat.completions.create,
                model=SCORING_MODEL,
                messages=[
                    {"role": "system", "content": settings["system_prompt"]},
                    {"role": "user", "content": evaluation_prompt}
                ],
                functions=[{
                    "name": "submit_evaluation",
                    "description": "Submit evaluation result",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "passed": {
                                "type": "boolean",
                                "description": "Whether the output meets the criterion requirements"
                            },
                            "explanation": {
                                "type": "string",
                                "description": "Brief explanation of why the output passed or failed"
                            }
                        },
                        "required": ["passed", "explanation"]
                    }
                }],
                function_call={"name": "submit_evaluation"},
                max_tokens=1000,
                temperature=settings["temperature"]
            )
            
            result = json.loads(response.choices[0].message.function_call.arguments)
            return {
                "result": "pass" if result["passed"] else "fail",
                "explanation": result["explanation"]
            }
                
        except Exception as e:
            logger.error(f"Error in evaluation: {str(e)}")
            if _ == 2:
                return {"result": "error", "explanation": str(e)}
            await asyncio.sleep(1)

@app.post("/evaluate")
async def evaluate(system_prompt: SystemPrompt):
    logger.info(f"Starting evaluation with prompt: {system_prompt.prompt}")
    
    async with get_async_session() as session:
        try:
            eval_type = await session.execute(
                select(EvaluationType).where(EvaluationType.name == "speech_to_text")
            )
            eval_type = eval_type.scalar_one()
            
            test_cases = await session.execute(
                select(TestCase)
                .join(Criterion)
                .where(Criterion.evaluation_type_id == eval_type.id)
                .order_by(TestCase.id)
            )
            test_cases = test_cases.scalars().all()
            
            analysis = await analyze_test_cases(session)
            
            # Count initial system prompt tokens
            system_prompt_tokens = count_tokens(system_prompt.prompt, EVALUATION_MODEL)
            
            evaluation = Evaluation(
                evaluation_type_id=eval_type.id,
                system_prompt=system_prompt.prompt,
                model_name=EVALUATION_MODEL,
                total_tokens=system_prompt_tokens  # Initialize with system prompt tokens
            )
            session.add(evaluation)
            await session.flush()

            total_cases = analysis["total_test_cases"]
            criteria_counts = {criterion: {'total': count, 'processed': 0} 
                             for criterion, count in analysis["counts_per_criterion"].items()}
            
            total_tokens = system_prompt_tokens
            
            for index, case in enumerate(test_cases, start=1):
                try:
                    criterion = case.criterion.name
                    system_message = system_prompt.prompt
                    user_message = case.input
                    
                    messages = [
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": user_message}
                    ]

                    response = await asyncio.to_thread(
                        client.chat.completions.create,
                        model=EVALUATION_MODEL,
                        messages=messages,
                        max_tokens=1500,
                        temperature=config["evaluation_settings"]["temperature"]
                    )

                    assistant_response = response.choices[0].message.content.strip()
                    evaluation_result = await evaluate_output(
                        case.input, 
                        assistant_response,
                        criterion,
                        case.description
                    )

                    # Count tokens for this interaction
                    prompt_tokens = count_tokens(user_message, EVALUATION_MODEL)  # Just user message as system prompt counted once
                    response_tokens = count_tokens(assistant_response, EVALUATION_MODEL)
                    
                    # Update total tokens
                    total_tokens += prompt_tokens + response_tokens

                    result = EvaluationResult(
                        evaluation_id=evaluation.id,
                        test_case_id=case.id,
                        output=assistant_response,
                        result=evaluation_result["result"],
                        explanation=evaluation_result["explanation"],
                        prompt_tokens=prompt_tokens,
                        response_tokens=response_tokens
                    )
                    session.add(result)
                    await session.flush()

                    # Update evaluation total tokens
                    evaluation.total_tokens = total_tokens
                    await session.flush()

                    criteria_counts[criterion]['processed'] += 1
                    progress = {
                        "total_progress": f"{index}/{total_cases}",
                        "criteria_progress": criteria_counts,
                        "stage": "evaluation",
                        "current_result": {
                            "id": case.id,
                            "criterion": criterion,
                            "result": evaluation_result["result"],
                            "evaluation_id": evaluation.id
                        }
                    }
                    await manager.broadcast(progress)

                except Exception as e:
                    logger.error(f"Error processing case {case.id}: {str(e)}")
                    progress = {
                        "total_progress": f"{index}/{total_cases}",
                        "criteria_progress": criteria_counts,
                        "stage": "error",
                        "error": str(e)
                    }
                    await manager.broadcast(progress)

                await asyncio.sleep(0.5)

            await session.commit()
            
            final_progress = {
                "total_progress": f"{total_cases}/{total_cases}",
                "criteria_progress": criteria_counts,
                "stage": "completed"
            }
            await manager.broadcast(final_progress)
            
            return {"message": "Evaluation completed", "evaluation_id": evaluation.id}

        except Exception as e:
            logger.error(f"Evaluation error: {str(e)}", exc_info=True)
            await manager.broadcast({"status": "error", "message": str(e)})
            raise HTTPException(status_code=500, detail=str(e))

def get_port():
    return repo_config["backend"]["port"]

@app.on_event("startup")
async def startup_event():
    await verify_database()

def count_tokens(text: str, model: str = "gpt-4o") -> int:
    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))

@app.get("/evaluations")
async def get_evaluations(page: int = 1, limit: int = 5):
    async with get_async_session() as session:
        try:
            count_stmt = select(Evaluation).join(EvaluationType).where(EvaluationType.name == "speech_to_text")
            result = await session.execute(count_stmt)
            total_count = len(result.scalars().all())
            
            offset = (page - 1) * limit
            stmt = (
                select(Evaluation)
                .options(
                    selectinload(Evaluation.results)
                    .selectinload(EvaluationResult.test_case)
                    .selectinload(TestCase.criterion)
                )
                .join(EvaluationType)
                .where(EvaluationType.name == "speech_to_text")
                .order_by(Evaluation.id.desc())
                .offset(offset)
                .limit(limit)
            )
            
            result = await session.execute(stmt)
            evaluations = result.scalars().all()
            
            evaluation_data = []
            for eval in evaluations:
                token_count = count_tokens(eval.system_prompt, eval.model_name)
                test_case_results = {}
                scores_by_criteria = {}

                for result in eval.results:
                    criterion_name = result.test_case.criterion.name
                    
                    if criterion_name not in scores_by_criteria:
                        scores_by_criteria[criterion_name] = {
                            "pass_count": 0,
                            "total_count": 0
                        }
                    scores_by_criteria[criterion_name]["total_count"] += 1
                    
                    if result.result == "pass":
                        scores_by_criteria[criterion_name]["pass_count"] += 1
                    
                    # Update test case results to include model information
                    test_case_results[result.test_case.id] = {
                        "id": result.test_case.id,
                        "criterion": criterion_name,
                        "input": result.test_case.input,
                        "description": result.test_case.description,
                        "output": result.output,
                        "result": result.result,
                        "explanation": result.explanation,
                        "input_model": eval.model_name,  # Add input model
                        "output_model": config["scoring_model"],  # Add output model
                        "prompt_tokens": result.prompt_tokens,  # Keep existing token info
                        "response_tokens": result.response_tokens
                    }
                
                total_score = sum(
                    criteria["pass_count"] 
                    for criteria in scores_by_criteria.values()
                )
                
                evaluation_data.append({
                    "id": eval.id,
                    "timestamp": eval.timestamp.isoformat(),
                    "system_prompt": eval.system_prompt,
                    "model_name": eval.model_name,
                    "total_score": total_score,
                    "token_count": token_count,
                    "scores_by_criteria": scores_by_criteria,
                    "test_case_results": test_case_results
                })
            
            return {
                "evaluations": evaluation_data,
                "total_count": total_count,
                "page": page,
                "pages": (total_count + limit - 1) // limit
            }
            
        except Exception as e:
            logger.error(f"Error fetching evaluations: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))



if __name__ == "__main__":
    import uvicorn
    port = get_port()
    logger.info(f"Starting FastAPI server on port {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)