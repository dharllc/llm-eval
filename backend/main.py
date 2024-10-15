# backend/main.py
# Activate virtual environment before running:
# source venv/bin/activate
# Start the server:
# uvicorn main:app --reload

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import json
from datetime import datetime
from openai import OpenAI
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
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
        for case in test_cases:
            logger.info(f"Processing case {case['id']}")

            # Prepare messages for ChatCompletion
            messages = [
                {"role": "system", "content": system_prompt.prompt},
                {"role": "user", "content": case['input']}
            ]

            try:
                response = client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=messages,
                    max_tokens=1500,  # Adjust based on your needs and token limits
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
        return {"message": "Evaluation completed", "output_file": output_file}

    except Exception as e:
        logger.error(f"Error during evaluation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Hello World"}

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting FastAPI server")
    uvicorn.run(app, host="0.0.0.0", port=8000)