import requests
import json

BASE_URL = "http://localhost:8035"

def test_case(query, description):
    print(f"\n--- Testing: {description} ---")
    print(f"Query: {query}")
    url = f"{BASE_URL}/api/chatbot/query"
    payload = {
        "query": query,
        "context": {
            "role": "employee",
            "user_id": "test_user",
            "route": "/home"
        }
    }
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            data = response.json()
            print(f"Answer: {data.get('answer')}")
            print(f"Confidence: {data.get('confidence')}")
        else:
            print(f"Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    # Wait for server if needed, but assuming it's up
    # 1. Leave request (Should answer if leave policy in Supabase)
    test_case("Write a leave request email", "Leave Request (Should be in scope if policy exists)")
    
    # 2. General knowledge (Should refuse)
    test_case("Who is Elon Musk?", "General Knowledge Fallback (Should be REFUSED per PDF)")
    
    # 3. Sports knowledge (Should refuse)
    test_case("What is IPL score today?", "Real-time Sports (Should be REFUSED per PDF)")
