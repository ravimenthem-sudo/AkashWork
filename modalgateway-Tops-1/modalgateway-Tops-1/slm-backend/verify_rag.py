import requests
import json

BASE_URL = "http://localhost:8035"

def test_rag_query():
    print("\n--- Testing RAG Query (Port 8035) ---")
    url = f"{BASE_URL}/api/chatbot/query"
    # Query that should trigger RAG (not hard action)
    payload = {
        "query": "What is the secret project code?",
        "context": {
            "role": "employee",
            "user_id": "test_user_123", # Needs to be seemingly valid
            "route": "/leaves"
        }
    }
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("Response:", json.dumps(response.json(), indent=2))
        else:
            print("Error:", response.text)
    except Exception as e:
        print(f"Exception: {e}")

def test_smart_buttons():
    print("\n--- Testing Smart Buttons (Port 8035) ---")
    url = f"{BASE_URL}/api/chatbot/context-buttons"
    payload = {
        "query": "", # FrontendChatRequest expects query
        "context": {
            "role": "employee",
            "route": "leaves"
        }
    }
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("Buttons:", json.dumps(response.json(), indent=2))
        else:
            print("Error:", response.text)
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    print("Verifying Unified Backend...")
    test_rag_query()
    test_smart_buttons()
