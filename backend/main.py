from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import os
import json
from datetime import datetime
from openai import OpenAI
import logging
import asyncio
from typing import List, Dict, Any

from database import (
    get_async_session, 
    EvaluationType, 
    Criterion, 
    TestCase, 
    Evaluation, 
    EvaluationResult,
    verify_database,
    snake_to_title_case
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

repo_config_path = os.path.join(os.path.dirname(__file__), "..", "config.json")
with open(repo_config_path, "r") as config_file:
    repo_config = json.load(config_file)

logger.info(f"Loaded repository configuration: {repo_config}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://localhost:{repo_config['frontend']['port']}"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

config_path = os.path.join(os.path.dirname(__file__), "config.json")
with open(config_path, "r") as config_file:
    config = json.load(config_file)
EVALUATION_MODEL = config.get("evaluation_model", "gpt-4o-mini")
SCORING_MODEL = config.get("scoring_model", "gpt-4o-mini")

logger.info(f"Loaded model configuration: Evaluation model: {EVALUATION_MODEL}, Scoring model: {SCORING_MODEL}")

@app.on_event("startup")
async def startup_event():
    await verify_database()

class SystemPrompt(BaseModel):
    prompt: str

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

async def analyze_test_cases(session: AsyncSession) -> dict:
    # Use join to eagerly load relationships
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
        await session.refresh(case, ['criterion'])  # Ensure criterion is loaded
        criterion_name = case.criterion.name
        if criterion_name not in criteria_counts:
            criteria_counts[criterion_name] = 0
        criteria_counts[criterion_name] += 1
    
    return {
        "criteria": {k: snake_to_title_case(k) for k in criteria_counts.keys()},
        "counts_per_criterion": criteria_counts,
        "total_test_cases": len(test_cases)
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message(f"You wrote: {data}", websocket)
            await manager.broadcast(f"Client says: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast("Client disconnected")

@app.get("/config")
async def get_config():
    return {"backendPort": repo_config["backend"]["port"]}

@app.get("/test-case-analysis")
async def get_test_case_analysis(session: AsyncSession = Depends(get_async_session)):
    return await analyze_test_cases(session)

async def evaluate_output(input_text: str, output_text: str, criterion: str, description: str):
    evaluation_prompt = f"""
    Evaluate the following language model output based on the given input, criterion, and description.
    Determine if the output meets the specified criterion.

    Input: {input_text}
    Output: {output_text}
    Criterion: {criterion}
    Description: {description}

    Respond with either "pass" or "fail" followed by a brief explanation (max 50 words).
    """

    try:
        response = client.chat.completions.create(
            model=SCORING_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert evaluator of language model outputs. Your task is to fairly and accurately assess the quality of responses based on given criteria."},
                {"role": "user", "content": evaluation_prompt}
            ],
            max_tokens=1000,
            temperature=0.3
        )
        evaluation = response.choices[0].message.content.strip()
        pass_fail = "pass" if evaluation.lower().startswith("pass") else "fail"
        explanation = evaluation.replace("pass", "", 1).replace("fail", "", 1).strip()
        return {"result": pass_fail, "explanation": explanation}
    except Exception as e:
        logger.error(f"Error in GPT-4 evaluation: {str(e)}")
        return {"result": "error", "explanation": str(e)}

@app.post("/evaluate")
async def evaluate(system_prompt: SystemPrompt):
    logger.info(f"Received evaluation request with prompt: {system_prompt.prompt}")
    try:
        async with get_async_session() as session:
            # Get evaluation type and test cases
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
            logger.info(f"Loaded {analysis['total_test_cases']} test cases")

            # Create evaluation record
            evaluation = Evaluation(
                evaluation_type_id=eval_type.id,
                system_prompt=system_prompt.prompt,
                model_name=EVALUATION_MODEL
            )
            session.add(evaluation)
            await session.flush()

            results = []
            total_cases = analysis["total_test_cases"]
            criteria_counts = {criterion: {'total': count, 'processed': 0} 
                             for criterion, count in analysis["counts_per_criterion"].items()}
            scoring_results = []

            for index, case in enumerate(test_cases, start=1):
                logger.info(f"Processing case {case.id}")

                criterion = case.criterion.name
                messages = [
                    {"role": "system", "content": system_prompt.prompt},
                    {"role": "user", "content": case.input}
                ]

                try:
                    response = await asyncio.to_thread(
                        client.chat.completions.create,
                        model=EVALUATION_MODEL,
                        messages=messages,
                        max_tokens=1500,
                        temperature=0.0,
                        top_p=1,
                        frequency_penalty=0,
                        presence_penalty=0
                    )

                    assistant_response = response.choices[0].message.content.strip()
                    evaluation_result = await evaluate_output(
                        case.input, 
                        assistant_response, 
                        criterion,
                        case.description
                    )

                    # Create evaluation result record
                    result = EvaluationResult(
                        evaluation_id=evaluation.id,
                        test_case_id=case.id,
                        output=assistant_response,
                        result=evaluation_result["result"],
                        explanation=evaluation_result["explanation"]
                    )
                    session.add(result)
                    await session.flush()

                    result_dict = {
                        "id": case.id,
                        "input": case.input,
                        "criterion": criterion,
                        "description": case.description,
                        "output": assistant_response,
                        "evaluation": evaluation_result
                    }
                    results.append(result_dict)
                    scoring_results.append({
                        "id": case.id,
                        "criterion": criterion,
                        "evaluation": evaluation_result
                    })

                    criteria_counts[criterion]['processed'] += 1
                    progress = {
                        "total_progress": f"{index}/{total_cases}",
                        "criteria_progress": criteria_counts,
                        "stage": "evaluation",
                        "current_result": {
                            "id": case.id,
                            "criterion": criterion,
                            "result": evaluation_result["result"]
                        }
                    }
                    await manager.broadcast(json.dumps(progress))

                except Exception as e:
                    logger.error(f"OpenAI API error for case {case.id}: {str(e)}")
                    result_dict = {
                        "id": case.id,
                        "input": case.input,
                        "criterion": criterion,
                        "description": case.description,
                        "output": f"Error: {str(e)}",
                        "evaluation": {"result": "error", "explanation": str(e)}
                    }
                    results.append(result_dict)
                    scoring_results.append({
                        "id": case.id,
                        "criterion": criterion,
                        "evaluation": {"result": "error", "explanation": str(e)}
                    })

                await asyncio.sleep(1)

            final_progress = {
                "total_progress": f"{total_cases}/{total_cases}",
                "criteria_progress": criteria_counts,
                "stage": "completed",
                "scoring_results": scoring_results
            }
            await manager.broadcast(json.dumps(final_progress))
            
            logger.info("Evaluation and scoring completed")
            return {"message": "Evaluation and scoring completed", "evaluation_id": evaluation.id}

    except Exception as e:
        logger.error(f"Error during evaluation: {str(e)}", exc_info=True)
        await manager.broadcast(json.dumps({"status": "error", "message": str(e)}))
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Hello World"}

def get_port():
    return repo_config["backend"]["port"]

if __name__ == "__main__":
    import uvicorn
    port = get_port()
    logger.info(f"Starting FastAPI server on port {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)