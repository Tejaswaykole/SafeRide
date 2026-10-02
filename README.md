# SafeRide

SafeRide is a low-cost IoT-based intelligent vehicle safety system that combines multiple sensor inputs, risk assessment, GPS tracking, and event intelligence to detect and monitor potentially dangerous vehicle conditions.

**USP:** A multi-sensor intelligent risk assessment system for low-cost vehicle safety.

## Hardware Status

**Hardware integration is pending because physical hardware is not currently available.** 
The current intelligence is a **RULE-BASED RISK ENGINE** (ML-based anomaly detection can be future scope).
All sensor data is simulated via a Python script to demonstrate the full software pipeline capability.

## Architecture & Technology Stack

**Data Flow Pipeline:**
`Simulator → FastAPI (REST + WebSocket) → Risk Engine → SQLAlchemy → Supabase PostgreSQL → React Dashboard`

**Tech Stack:**
- **Frontend:** React, TailwindCSS, Vite
- **Backend:** FastAPI, Python, WebSockets, SQLAlchemy 2.0
- **Database:** Supabase PostgreSQL

## How to Run the Complete Software Demo

To run the full software-verified pipeline, open three separate terminal windows.

### Terminal 1: Start Backend (FastAPI)
```powershell
cd backend
venv\Scripts\activate
uvicorn main:app --port 8000
```

### Terminal 2: Start Frontend (React)
```powershell
cd frontend
npm run dev
```

### Terminal 3: Start Hardware Simulator
```powershell
cd backend
venv\Scripts\activate
python simulator.py --scenario cycle
```

## Available Scenarios
By default, the simulator runs in a `cycle` scenario that rotates through all conditions. You can also manually trigger specific states:
- `python simulator.py --scenario normal` (SAFE state)
- `python simulator.py --scenario rash` (WARNING state, Rash Driving)
- `python simulator.py --scenario alcohol` (WARNING state, Alcohol Detected)
- `python simulator.py --scenario critical` (CRITICAL state, Engine OFF)
