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

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Load repository configuration
repo_config_path = os.path.join(os.path.dirname(__file__), "..", "config.json")
with open(repo_config_path, "r") as config_file:
    repo_config = json.load(config_file)

# Log the loaded configuration
logger.info(f"Loaded configuration: {repo_config}")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://localhost:{repo_config['frontend']['port']}"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
load_dotenv()

# Set up OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Load model configuration
config_path = os.path.join(os.path.dirname(__file__), "config.json")
with open(config_path, "r") as config_file:
    config = json.load(config_file)
MODEL_NAME = config.get("model_name", "gpt-4")  # Default to gpt-4 if not specified

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

@app.post("/evaluate")
async def evaluate(system_prompt: SystemPrompt):
    logger.info(f"Received evaluation request with prompt: {system_prompt.prompt}")
    try:
        # Load test cases
        test_cases_path = os.path.join(os.path.dirname(__file__), "../data/evaluation_test_cases.json")
        with open(test_cases_path, "r") as f:
            test_cases = json.load(f)["test_cases"]
        logger.info(f"Loaded {len(test_cases)} test cases")

        results = []
        total_cases = len(test_cases)
        criteria_counts = {}

        for index, case in enumerate(test_cases, start=1):
            logger.info(f"Processing case {case['id']}")

            # Update criteria counts
            criterion = case['criterion']
            if criterion not in criteria_counts:
                criteria_counts[criterion] = {'total': 0, 'processed': 0}
            criteria_counts[criterion]['total'] += 1

            # Prepare messages for ChatCompletion
            messages = [
                {"role": "system", "content": system_prompt.prompt},
                {"role": "user", "content": case['input']}
            ]

            try:
                response = client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=messages,
                    max_tokens=1500,
                    temperature=0.7,
                    top_p=1,
                    frequency_penalty=0,
                    presence_penalty=0
                )

                assistant_response = response.choices[0].message.content.strip()

                result = {
                    "id": case["id"],
                    "input": case["input"],
                    "criterion": case["criterion"],
                    "description": case["description"],
                    "output": assistant_response
                }
                results.append(result)

                # Update progress
                criteria_counts[criterion]['processed'] += 1
                progress = {
                    "total_progress": f"{index}/{total_cases}",
                    "criteria_progress": criteria_counts
                }
                progress_json = json.dumps(progress)
                logger.info(f"Broadcasting progress update: {progress_json}")
                await manager.broadcast(progress_json)

            except Exception as e:
                logger.error(f"OpenAI API error for case {case['id']}: {str(e)}")
                result = {
                    "id": case["id"],
                    "input": case["input"],
                    "criterion": case["criterion"],
                    "description": case["description"],
                    "output": f"Error: {str(e)}"
                }
                results.append(result)

            # Simulate some processing time
            await asyncio.sleep(1)

        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(os.path.dirname(__file__), f"../data/eval_results_{timestamp}.json")
        output_data = {
            "timestamp": timestamp,
            "system_prompt": system_prompt.prompt,
            "model_name": MODEL_NAME,
            "results": results
        }

        with open(output_file, "w") as f:
            json.dump(output_data, f, indent=2)
        
        logger.info(f"Evaluation completed. Results saved to {output_file}")
        await manager.broadcast(json.dumps({"status": "completed", "output_file": output_file}))
        return {"message": "Evaluation completed", "output_file": output_file}

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