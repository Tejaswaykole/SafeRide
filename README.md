# SafeRide
Here we making an software for safe ride project that connects hardware + Software 

## How to Run the Complete Software Demo

Since hardware is not yet available, the full system is demonstrated via a software simulator. To run the full software-verified pipeline, open three separate terminal windows.

### Terminal 1: Start Backend (FastAPI)
``powershell
cd backend
venv\Scripts\activate
python -m pip install websockets  # If not installed
uvicorn main:app --port 8000
``

### Terminal 2: Start Frontend (React)
``powershell
cd frontend
npm run dev
``

### Terminal 3: Start Hardware Simulator
``powershell
cd backend
venv\Scripts\activate
python simulator.py --scenario cycle
``

### Demo Scenarios
By default, the simulator runs in a \cycle\ scenario. You can also run specific test modes:
- \python simulator.py --scenario normal\ (SAFE state)
- \python simulator.py --scenario rash\ (WARNING state)
- \python simulator.py --scenario alcohol\ (WARNING state)
- \python simulator.py --scenario critical\ (CRITICAL state - Engine OFF)

