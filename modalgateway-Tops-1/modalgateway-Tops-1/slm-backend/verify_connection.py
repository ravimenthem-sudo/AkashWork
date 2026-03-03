import requests
import json
import sys

def check_connection():
    url = "http://127.0.0.1:8035/health"
    print(f"Testing connection to {url}...")
    try:
        response = requests.get(url, timeout=5)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        if response.status_code == 200:
            print("SUCCESS: Backend is reachable!")
            return True
        else:
            print("FAILURE: Backend returned non-200 status.")
            return False
    except requests.exceptions.ConnectionError:
        print("FAILURE: Could not connect to backend (Connection Refused).")
        return False
    except Exception as e:
        print(f"FAILURE: Error: {e}")
        return False

def check_chat():
    url = "http://127.0.0.1:8035/api/chatbot/query"
    payload = {
        "query": "show me my remaining leaves",
        "context": {"role": "employee", "user_id": "test_user"}
    }
    print(f"\nTesting Chat Endpoint {url}...")
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        if response.status_code == 200:
            print("SUCCESS: Chat endpoint works!")
        else:
            print("FAILURE: Chat endpoint returned error.")
    except Exception as e:
        print(f"FAILURE: Chat endpoint error: {e}")

if __name__ == "__main__":
    if check_connection():
        check_chat()
