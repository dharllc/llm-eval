from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import os
import json
from datetime import datetime
import logging
import asyncio
from typing import List, Dict, Any, Set, Optional
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

from llm_interaction import (
    get_completion_for_provider,
    get_model_provider,
    calculate_cost,
    count_tokens
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

config_path = os.path.join(os.path.dirname(__file__), "backend_config.json")
with open(config_path, "r") as config_file:
    config = json.load(config_file)

EVALUATION_MODEL = config.get("default_evaluation_model")
SCORING_MODEL = config.get("default_scoring_model")

class SystemPrompt(BaseModel):
    prompt: str
    evaluation_model: Optional[str] = None
    scoring_model: Optional[str] = None

class TestCaseQuery(BaseModel):
    evaluation_id: int
    test_case_id: int
    criterion: str

class ModelSelection(BaseModel):
    evaluation_model: str
    scoring_model: str

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
            test_case = await session.execute(
                select(TestCase)
                .options(selectinload(TestCase.criterion))
                .where(TestCase.id == test_case_id)
            )
            test_case = test_case.scalar_one_or_none()
            
            if not test_case:
                raise HTTPException(status_code=404, detail="Test case not found")
            
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
                "output_model": eval_result.evaluation.scoring_model
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
        "models": config["models"],
        "defaultEvaluationModel": config["default_evaluation_model"],
        "defaultScoringModel": config["default_scoring_model"],
        "currentEvaluationModel": EVALUATION_MODEL,
        "currentScoringModel": SCORING_MODEL
    }

@app.post("/models/select")
async def select_models(selection: ModelSelection):
    global EVALUATION_MODEL, SCORING_MODEL
    
    if selection.evaluation_model not in [model for provider in config["models"].values() for model in provider]:
        raise HTTPException(status_code=400, detail=f"Invalid evaluation model: {selection.evaluation_model}")
    
    if selection.scoring_model not in [model for provider in config["models"].values() for model in provider]:
        raise HTTPException(status_code=400, detail=f"Invalid scoring model: {selection.scoring_model}")
    
    EVALUATION_MODEL = selection.evaluation_model
    SCORING_MODEL = selection.scoring_model
    
    return {"message": "Model selection updated successfully"}

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
        
async def evaluate_output(input_text: str, output_text: str, criterion: str, description: str, model: str = None):
    for _ in range(3):
        try:
            settings = config["evaluation_settings"]
            evaluation_prompt = settings["evaluation_prompt_template"].format(
                input=input_text,
                output=output_text,
                criterion=criterion,
                description=description
            )

            scoring_model = model or SCORING_MODEL
            provider = await get_model_provider(scoring_model, config)
            
            messages = [
                {"role": "system", "content": settings["system_prompt"]},
                {"role": "user", "content": evaluation_prompt}
            ]

            response_text = await get_completion_for_provider(
                provider=provider,
                model=scoring_model,
                messages=messages,
                temperature=settings["temperature"]
            )

            # Extract pass/fail and explanation from the response
            lines = response_text.strip().split('\n')
            passed = any('pass' in line.lower() for line in lines)
            explanation = '\n'.join(line for line in lines if 'pass' not in line.lower() and 'fail' not in line.lower())

            return {
                "result": "pass" if passed else "fail",
                "explanation": explanation.strip(),
                "prompt_tokens": count_tokens(evaluation_prompt, scoring_model),
                "response_tokens": count_tokens(response_text, scoring_model)
            }
                
        except Exception as e:
            logger.error(f"Error in evaluation: {str(e)}")
            if _ == 2:
                return {"result": "error", "explanation": str(e)}
            await asyncio.sleep(1)

@app.post("/evaluate")
async def evaluate(system_prompt: SystemPrompt):
    logger.info(f"Starting evaluation with prompt: {system_prompt.prompt}")
    
    eval_model = system_prompt.evaluation_model or EVALUATION_MODEL
    scoring_model = system_prompt.scoring_model or SCORING_MODEL

    # Validate models
    try:
        eval_provider = await get_model_provider(eval_model, config)
        scoring_provider = await get_model_provider(scoring_model, config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
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
            
            # Count initial system prompt tokens and calculate cost
            system_prompt_tokens = count_tokens(system_prompt.prompt, eval_model)
            input_cost = await calculate_cost(system_prompt_tokens, eval_model, "input", config)
            
            evaluation = Evaluation(
                evaluation_type_id=eval_type.id,
                system_prompt=system_prompt.prompt,
                model_name=eval_model,
                scoring_model=scoring_model,
                total_tokens=system_prompt_tokens,
                total_cost=input_cost
            )
            session.add(evaluation)
            await session.flush()

            total_cases = analysis["total_test_cases"]
            criteria_counts = {criterion: {'total': count, 'processed': 0} 
                             for criterion, count in analysis["counts_per_criterion"].items()}
            
            total_tokens = system_prompt_tokens
            total_cost = input_cost
            
            for index, case in enumerate(test_cases, start=1):
                try:
                    criterion = case.criterion.name
                    messages = [
                        {"role": "system", "content": system_prompt.prompt},
                        {"role": "user", "content": case.input}
                    ]

                    # Get completion from selected provider
                    assistant_response = await get_completion_for_provider(
                        provider=eval_provider,
                        model=eval_model,
                        messages=messages,
                        temperature=config["evaluation_settings"]["temperature"]
                    )

                    evaluation_result = await evaluate_output(
                        case.input, 
                        assistant_response,
                        criterion,
                        case.description,
                        scoring_model
                    )

                    # Calculate tokens and costs
                    prompt_tokens = count_tokens(case.input, eval_model)
                    response_tokens = count_tokens(assistant_response, eval_model)
                    
                    input_cost = await calculate_cost(prompt_tokens, eval_model, "input", config)
                    output_cost = await calculate_cost(response_tokens, eval_model, "output", config)
                    
                    eval_cost = input_cost + output_cost
                    
                    # Calculate scoring costs
                    scoring_input_cost = await calculate_cost(
                        evaluation_result["prompt_tokens"], 
                        scoring_model, 
                        "input", 
                        config
                    )
                    scoring_output_cost = await calculate_cost(
                        evaluation_result["response_tokens"], 
                        scoring_model, 
                        "output", 
                        config
                    )
                    
                    scoring_cost = scoring_input_cost + scoring_output_cost
                    
                    total_tokens += prompt_tokens + response_tokens
                    total_cost += eval_cost + scoring_cost

                    result = EvaluationResult(
                        evaluation_id=evaluation.id,
                        test_case_id=case.id,
                        output=assistant_response,
                        result=evaluation_result["result"],
                        explanation=evaluation_result["explanation"],
                        prompt_tokens=prompt_tokens,
                        response_tokens=response_tokens,
                        evaluation_cost=eval_cost,
                        scoring_cost=scoring_cost
                    )
                    session.add(result)
                    await session.flush()

                    # Update evaluation totals
                    evaluation.total_tokens = total_tokens
                    evaluation.total_cost = total_cost
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
                            "evaluation_id": evaluation.id,
                            "cost": eval_cost + scoring_cost
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
                "stage": "completed",
                "total_cost": total_cost
            }
            await manager.broadcast(final_progress)
            
            return {"message": "Evaluation completed", "evaluation_id": evaluation.id}

        except Exception as e:
            logger.error(f"Evaluation error: {str(e)}", exc_info=True)
            await manager.broadcast({"status": "error", "message": str(e)})
            raise HTTPException(status_code=500, detail=str(e))
        
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
                test_case_results = {}
                scores_by_criteria = {}

                for result in eval.results:
                    criterion_name = result.test_case.criterion.name
                    
                    if criterion_name not in scores_by_criteria:
                        scores_by_criteria[criterion_name] = {
                            "pass_count": 0,
                            "total_count": 0,
                            "cost": 0
                        }
                    scores_by_criteria[criterion_name]["total_count"] += 1
                    scores_by_criteria[criterion_name]["cost"] += (result.evaluation_cost + result.scoring_cost)
                    
                    if result.result == "pass":
                        scores_by_criteria[criterion_name]["pass_count"] += 1
                    
                    test_case_results[result.test_case.id] = {
                        "id": result.test_case.id,
                        "criterion": criterion_name,
                        "input": result.test_case.input,
                        "description": result.test_case.description,
                        "output": result.output,
                        "result": result.result,
                        "explanation": result.explanation,
                        "input_model": eval.model_name,
                        "output_model": eval.scoring_model,
                        "prompt_tokens": result.prompt_tokens,
                        "response_tokens": result.response_tokens,
                        "evaluation_cost": result.evaluation_cost,
                        "scoring_cost": result.scoring_cost
                    }
                
                total_score = sum(
                    criteria["pass_count"] 
                    for criteria in scores_by_criteria.values()
                )
                
                total_cost = sum(
                    criteria["cost"]
                    for criteria in scores_by_criteria.values()
                )
                
                evaluation_data.append({
                    "id": eval.id,
                    "timestamp": eval.timestamp.isoformat(),
                    "system_prompt": eval.system_prompt,
                    "model_name": eval.model_name,
                    "scoring_model": eval.scoring_model,
                    "total_score": total_score,
                    "total_tokens": eval.total_tokens,
                    "total_cost": total_cost,
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

@app.get("/models")
async def get_available_models():
    return {
        "models": config["models"],
        "current": {
            "evaluation_model": EVALUATION_MODEL,
            "scoring_model": SCORING_MODEL
        },
        "default": {
            "evaluation_model": config["default_evaluation_model"],
            "scoring_model": config["default_scoring_model"]
        }
    }

@app.get("/models/cost/{model_name}")
async def get_model_cost(model_name: str):
    try:
        provider = await get_model_provider(model_name, config)
        return {
            "model": model_name,
            "provider": provider,
            "costs": config["models"][provider][model_name]
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.on_event("startup")
async def startup_event():
    await verify_database()

def get_port():
    return repo_config["backend"]["port"]

if __name__ == "__main__":
    import uvicorn
    port = get_port()
    logger.info(f"Starting FastAPI server on port {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)