#!/bin/bash

# Get the port from the config file
PORT=$(python -c "import json; print(json.load(open('../config.json'))['backend']['port'])")

# Run uvicorn with the extracted port
uvicorn main:app --reload --host 0.0.0.0 --port $PORT