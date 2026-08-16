echo "Starting VYOM Backend (FastAPI)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd vyom-backend; python run.py"

echo "Starting VYOM Frontend (Vite)..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"
