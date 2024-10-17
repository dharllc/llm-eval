#!/bin/bash

# Read the frontend and backend ports from config.json
FRONTEND_PORT=$(jq -r '.frontend.port' ../config.json)
BACKEND_PORT=$(jq -r '.backend.port' ../config.json)

# Print debug information
echo "Frontend Port: $FRONTEND_PORT"
echo "Backend Port: $BACKEND_PORT"

# Set the environment variables and start the React app
PORT=$FRONTEND_PORT REACT_APP_BACKEND_PORT=$BACKEND_PORT npm start