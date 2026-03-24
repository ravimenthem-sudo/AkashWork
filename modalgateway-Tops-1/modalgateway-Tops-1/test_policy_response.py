import requests
import json

def test_policy():
    url = "http://127.0.0.1:8035/api/chatbot/query"
    payload = {
        "query": "explain the leave policy",
        "user_id": "9445888e-670d-4581-9878-0cf8369cd71a",
        "org_id": "dde0a075-5eb3-4b4b-8de3-0a6b1162951f",
        "project_id": "29cb0c91-0df6-4b41-949e-ec80dcf0a43f",
        "task_id": "d2fa986e-5c25-401e-a5d9-77e9fd51946d",
        "app_name": "talentops"
    }
    
    response = requests.post(url, json=payload)
    print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    test_policy()
