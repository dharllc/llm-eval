from fastapi import HTTPException
from openai import AsyncOpenAI
from anthropic import Anthropic
import google.generativeai as genai
import os
import tiktoken
from dotenv import load_dotenv

load_dotenv()

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
google_api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=google_api_key)

def get_encoding(model: str):
    try:
        return tiktoken.encoding_for_model(model)
    except KeyError:
        return tiktoken.get_encoding("cl100k_base")

def count_tokens(text: str, model: str) -> int:
    encoding = get_encoding(model)
    return len(encoding.encode(text))

async def openai_completion(model: str, messages: list, temperature: float):
    try:
        response = await openai_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature
        )
        return response.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")

async def anthropic_completion(model: str, messages: list, temperature: float):
    formatted_messages = []
    system_content = ""
    
    for msg in messages:
        role = msg['role']
        content = msg['content'].strip()
        
        if not content:
            continue
            
        if role == 'system':
            system_content += f"{content}\n\n"
        elif role == 'user':
            if system_content:
                content = f"{system_content}{content}"
                system_content = ""
            formatted_messages.append({"role": "user", "content": content})
        elif role == 'assistant':
            formatted_messages.append({"role": "assistant", "content": content})
    
    if system_content and (not formatted_messages or formatted_messages[0]['role'] != 'user'):
        formatted_messages.insert(0, {"role": "user", "content": system_content})
    
    try:
        response = anthropic_client.messages.create(
            model=model,
            messages=formatted_messages,
            temperature=temperature,
            max_tokens=4096
        )
        return response.content[0].text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anthropic API error: {str(e)}")

async def google_completion(model: str, messages: list, temperature: float):
    try:
        model_instance = genai.GenerativeModel(model_name=model)
        prompt = "\n".join([f"{msg['role'].capitalize()}: {msg['content']}" for msg in messages])
        response = await model_instance.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=temperature
            )
        )
        return response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google API error: {str(e)}")

async def get_completion_for_provider(provider: str, model: str, messages: list, temperature: float):
    if provider == "OpenAI":
        return await openai_completion(model, messages, temperature)
    elif provider == "Anthropic":
        return await anthropic_completion(model, messages, temperature)
    elif provider == "Google":
        return await google_completion(model, messages, temperature)
    else:
        raise ValueError(f"Unsupported provider: {provider}")

async def get_model_provider(model: str, config: dict) -> str:
    for provider, models in config["models"].items():
        if model in models:
            return provider
    raise ValueError(f"Model {model} not found in configuration")

async def calculate_cost(tokens: int, model: str, token_type: str, config: dict) -> float:
    provider = await get_model_provider(model, config)
    cost_per_million = config["models"][provider][model][token_type]
    return (tokens / 1_000_000) * cost_per_million