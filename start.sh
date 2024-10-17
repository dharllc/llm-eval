#!/bin/bash

# Function to stop all background processes
cleanup() {
    echo "Stopping all processes..."
    kill $(jobs -p)
    exit
}

# Set up trap to call cleanup function on script exit
trap cleanup EXIT

# Start backend
echo "Starting backend..."
cd backend
./backend_start.sh &
backend_pid=$!

# Wait a bit for backend to start
sleep 2

# Check if backend started successfully
if ! kill -0 $backend_pid 2>/dev/null; then
    echo "Failed to start backend"
    exit 1
fi

# Start frontend
echo "Starting frontend..."
cd ../frontend
./frontend_start.sh &
frontend_pid=$!

# Wait for both processes
wait $backend_pid $frontend_pid