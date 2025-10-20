#!/bin/bash
# ===============================
# One-click dev runner for macOS
# - Kills ports 8080 (server) and 5173 (Vite)
# - Starts server and client in separate terminal windows
# - Installs deps if node_modules missing
# ===============================

# Anchor to repo root
cd "$(dirname "$0")"

echo ""
echo "[One-Click Dev] Cleaning up ports 8080 and 5173 (if any)..."

# Kill processes on ports 8080 and 5173
for port in 8080 5173; do
    pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        echo "Killing process $pid on port $port"
        kill -9 $pid
    fi
done

# Server commands
SERVER_CMD="cd server && [ ! -d node_modules ] && (npm ci || npm i); npm start"

# Client commands  
CLIENT_CMD="cd client && [ ! -d node_modules ] && (npm ci || npm i); VITE_API_BASE_URL=http://localhost:8080 npm run dev"

echo "[One-Click Dev] Launching SERVER (port 8080) in new terminal..."
osascript -e "tell application \"Terminal\" to do script \"cd '$PWD' && $SERVER_CMD\""

# Add a small delay so logs are readable in order
sleep 3

echo "[One-Click Dev] Launching CLIENT (Vite) in new terminal..."
osascript -e "tell application \"Terminal\" to do script \"cd '$PWD' && $CLIENT_CMD\""

# Add doctor check window (optional)
DOCTOR_CMD="cd server && sleep 8 && npm run doctor"
echo "[One-Click Dev] Launching DOCTOR (diagnostics) in new terminal..."
osascript -e "tell application \"Terminal\" to do script \"cd '$PWD' && $DOCTOR_CMD\""

# Wait a bit for the client to start up, then open browser
echo "[One-Click Dev] Waiting for Vite dev server to start..."
sleep 5

echo "[One-Click Dev] Opening browser to http://localhost:5173"
open "http://localhost:5173"

echo ""
echo "[One-Click Dev] All terminal windows launched and browser opened."
