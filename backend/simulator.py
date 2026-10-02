import argparse
import time
import random
import requests
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000/api"

def get_base_reading(device_id, current_lat, current_lon):
    return {
        "device_id": device_id,
        "alcohol_value": 300 + random.uniform(-10, 10),
        "accel_x": 0.0 + random.uniform(-0.05, 0.05),
        "accel_y": 0.0 + random.uniform(-0.05, 0.05),
        "accel_z": 9.8 + random.uniform(-0.05, 0.05),
        "gyro_x": 0.0 + random.uniform(-1, 1),
        "gyro_y": 0.0 + random.uniform(-1, 1),
        "gyro_z": 0.0 + random.uniform(-1, 1),
        "temperature": 30.0 + random.uniform(-0.5, 0.5),
        "latitude": current_lat,
        "longitude": current_lon,
        "blow_detected": False
    }

def apply_scenario(payload, scenario):
    if scenario == "rash":
        payload["accel_x"] += random.uniform(3.0, 5.0)
        payload["gyro_y"] += random.uniform(200.0, 300.0)
    elif scenario == "alcohol":
        payload["blow_detected"] = True
        payload["alcohol_value"] = random.uniform(1200, 1500)
    elif scenario == "critical":
        payload["blow_detected"] = True
        payload["alcohol_value"] = random.uniform(1200, 1500)
        payload["accel_x"] += random.uniform(3.0, 5.0)
        payload["gyro_y"] += random.uniform(200.0, 300.0)
    return payload

def reset_vehicle(device_id):
    try:
        print("\n--- RESETTING VEHICLE ---")
        # Need vehicle_id instead of device_id for the endpoint
        r = requests.get(f"{BASE_URL}/vehicles")
        if r.status_code == 200:
            vehicles = [v for v in r.json() if v['device_id'] == device_id]
            if vehicles:
                v_id = vehicles[0]['id']
                r_reset = requests.post(f"{BASE_URL}/vehicles/{v_id}/reset")
                if r_reset.status_code == 200:
                    print("Vehicle reset successfully.")
                else:
                    print(f"Failed to reset: {r_reset.text}")
            else:
                print("Vehicle not found in database.")
    except Exception as e:
        print(f"Error resetting vehicle: {e}")

def run_simulation(args):
    scenario_sequence = [args.scenario]
    if args.scenario == "cycle":
        scenario_sequence = ["normal", "normal", "rash", "rash", "normal", "alcohol", "alcohol", "normal", "critical", "critical", "normal"]
        
    print(f"Starting SafeRide Simulator (Target: {BASE_URL})")
    print(f"Device: {args.device_id}, Interval: {args.interval}s")
    
    try:
        # Just to verify backend is up
        requests.get(f"{BASE_URL}/health")
    except requests.exceptions.ConnectionError:
        print("\nError: Backend is not available at", BASE_URL)
        print("Please start the FastAPI backend first using 'uvicorn main:app'.")
        return

    current_lat = args.lat
    current_lon = args.lon
    
    step = 0
    try:
        while True:
            current_scenario = scenario_sequence[step % len(scenario_sequence)]
            
            # Simulate smooth movement
            current_lat += random.uniform(0.00001, 0.00005)
            current_lon += random.uniform(0.00001, 0.00005)
            
            payload = get_base_reading(args.device_id, current_lat, current_lon)
            payload = apply_scenario(payload, current_scenario)
            
            try:
                response = requests.post(f"{BASE_URL}/sensor-data", json=payload)
                if response.status_code == 200:
                    data = response.json()
                    ts = datetime.now().strftime("%H:%M:%S")
                    print(f"[{ts}] Scenario: {current_scenario.upper():8} | "
                          f"Alc: {'YES' if data['alcohol_detected'] else 'NO':3} | "
                          f"Rash: {'YES' if data['rash_driving_detected'] else 'NO':3} | "
                          f"Risk: {data['risk_score']:2} | "
                          f"Status: {data['status']:8} | "
                          f"Engine: {data['engine_state']}")
                else:
                    print(f"Error sending data: {response.status_code} - {response.text}")
            except requests.exceptions.ConnectionError:
                print("Error: Connection to backend lost.")
            
            time.sleep(args.interval)
            step += 1
            if args.scenario == "cycle" and step >= len(scenario_sequence):
                if getattr(args, 'reset', False):
                    reset_vehicle(args.device_id)
                break
                
    except KeyboardInterrupt:
        print("\nSimulator stopped by user.")
        if args.scenario == "cycle" or getattr(args, 'reset', False):
            reset_vehicle(args.device_id)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SafeRide Sensor Simulator")
    parser.add_argument("--scenario", choices=["normal", "rash", "alcohol", "critical", "cycle"], default="normal", help="Simulation scenario")
    parser.add_argument("--interval", type=float, default=1.0, help="Interval between requests in seconds")
    parser.add_argument("--device_id", type=str, default="SAFERIDE-001", help="Device ID to simulate")
    parser.add_argument("--reset", action="store_true", help="Reset vehicle after stopping")
    parser.add_argument("--lat", type=float, default=18.5204, help="Starting latitude")
    parser.add_argument("--lon", type=float, default=73.8567, help="Starting longitude")
    
    args = parser.parse_args()
    run_simulation(args)
