from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import json
from datetime import datetime
from openai import OpenAI
import logging
import asyncio
from typing import List, Dict, Any

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
        test_cases_path = os.path.join(os.path.dirname(__file__), "evaluation_test_cases.json")
        with open(test_cases_path, "r") as f:
            test_cases = json.load(f)["test_cases"]
        logger.info(f"Loaded {len(test_cases)} test cases")

        results = []
        total_cases = len(test_cases)
        criteria_counts = {}
        scoring_results = []

        for index, case in enumerate(test_cases, start=1):
            logger.info(f"Processing case {case['id']}")

            criterion = case['criterion']
            if criterion not in criteria_counts:
                criteria_counts[criterion] = {'total': 0, 'processed': 0}
            criteria_counts[criterion]['total'] += 1

            messages = [
                {"role": "system", "content": system_prompt.prompt},
                {"role": "user", "content": case['input']}
            ]

            try:
                response = client.chat.completions.create(
                    model=EVALUATION_MODEL,
                    messages=messages,
                    max_tokens=1500,
                    temperature=0.0,
                    top_p=1,
                    frequency_penalty=0,
                    presence_penalty=0
                )

                assistant_response = response.choices[0].message.content.strip()

                evaluation = await evaluate_output(case['input'], assistant_response, case['criterion'], case['description'])

                result = {
                    "id": case["id"],
                    "input": case["input"],
                    "criterion": case["criterion"],
                    "description": case["description"],
                    "output": assistant_response,
                    "evaluation": evaluation
                }
                results.append(result)
                scoring_results.append({
                    "id": case["id"],
                    "criterion": case["criterion"],
                    "evaluation": evaluation
                })

                criteria_counts[criterion]['processed'] += 1
                progress = {
                    "total_progress": f"{index}/{total_cases}",
                    "criteria_progress": criteria_counts,
                    "stage": "evaluation",
                    "current_result": {
                        "id": case["id"],
                        "criterion": case["criterion"],
                        "result": evaluation["result"]
                    }
                }
                await manager.broadcast(json.dumps(progress))

            except Exception as e:
                logger.error(f"OpenAI API error for case {case['id']}: {str(e)}")
                result = {
                    "id": case["id"],
                    "input": case["input"],
                    "criterion": case["criterion"],
                    "description": case["description"],
                    "output": f"Error: {str(e)}",
                    "evaluation": {"result": "error", "explanation": str(e)}
                }
                results.append(result)
                scoring_results.append({
                    "id": case["id"],
                    "criterion": case["criterion"],
                    "evaluation": {"result": "error", "explanation": str(e)}
                })

            await asyncio.sleep(1)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(os.path.dirname(__file__), f"../data/eval_results_{timestamp}.json")
        output_data = {
            "timestamp": timestamp,
            "system_prompt": system_prompt.prompt,
            "model_name": EVALUATION_MODEL,
            "results": results
        }
        with open(output_file, "w") as f:
            json.dump(output_data, f, indent=2)

        scoring_file = os.path.join(os.path.dirname(__file__), f"../data/scoring_results_{timestamp}.json")
        scoring_data = {
            "timestamp": timestamp,
            "model_name": SCORING_MODEL,
            "scoring_results": scoring_results
        }
        with open(scoring_file, "w") as f:
            json.dump(scoring_data, f, indent=2)

        final_progress = {
            "total_progress": f"{total_cases}/{total_cases}",
            "criteria_progress": criteria_counts,
            "stage": "completed",
            "scoring_results": scoring_results
        }
        await manager.broadcast(json.dumps(final_progress))

        logger.info(f"Evaluation and scoring completed. Results saved to {output_file} and {scoring_file}")
        return {"message": "Evaluation and scoring completed", "output_file": output_file, "scoring_file": scoring_file}

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