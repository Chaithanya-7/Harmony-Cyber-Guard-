import base64
import json
import os

import numpy as np
import requests

def test_ml_service():
    url = os.getenv("ML_SERVICE_URL", "http://localhost:8005")
    print(f"Testing CyberGuard ML Service at {url}...")

    print("\n--- Testing Health ---")
    response = requests.get(f"{url}/healthz")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

    print("\n--- Testing Readiness ---")
    response = requests.get(f"{url}/readyz")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

    # 1. Test Text Analysis
    print("\n--- Testing Text Analysis ---")
    text_payload = {"text": "I am from the IRS and you will be arrested if you don't pay $5000 immediately."}
    try:
        response = requests.post(f"{url}/analyze/text", json=text_payload)
        print(f"Status: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

    # 2. Test Call Analysis (with mock audio)
    print("\n--- Testing Call Analysis ---")
    # Create 1 second of mock silence/noise
    audio_data = np.random.uniform(-1, 1, 16000).astype(np.float32)
    audio_b64 = base64.b64encode(audio_data.tobytes()).decode('utf-8')
    
    call_payload = {
        "transcript": "Hello, this is officer Smith. We have a warrant for your arrest.",
        "audioBase64": audio_b64
    }
    
    try:
        response = requests.post(f"{url}/analyze/call", json=call_payload)
        print(f"Status: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

    # 3. Test Caller Analysis
    print("\n--- Testing Caller Analysis ---")
    caller_payload = {
        "phoneNumber": "+1234567890",
        "metadata": {"carrier": "VOIP", "location": "Unknown"}
    }
    try:
        response = requests.post(f"{url}/analyze/caller", json=caller_payload)
        print(f"Status: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_ml_service()
