import requests
import json

url = "http://localhost:8035/api/chatbot/query"
payload = {
    "query": "how many layers are there in the LLM document",
    "user_id": "test_user",
    "org_id": "dde0a075-5eb3-4b4b-8de3-0a6b1162951f",
    "project_id": "11d82a1c-f4fe-4249-b8b0-ce61166c2f43",
    "user_role": "Employee",
    "app_name": "talentops"
}
headers = {"Content-Type": "application/json"}

try:
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status: {response.status_code}")
    print("Response:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
