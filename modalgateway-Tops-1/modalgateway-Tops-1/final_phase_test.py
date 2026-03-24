import requests
import json

url = "http://localhost:8035/slm/chat"
headers = {"Content-Type": "application/json"}

org_id = "dde0a075-5eb3-4b4b-8de3-0a6b1162951f"
project_id = "833ab297-c466-41f2-8e10-be550787e220"
task_id = "4fe68575-9c98-4428-a593-df90779d259d"
phase_id = "design_guidance"

payload = {
    "query": "explain the design phase document of chatbot backend task",
    "user_id": "test_user",
    "org_id": org_id,
    "project_id": project_id,
    "task_id": task_id,
    "phase": phase_id,
    "app_name": "talentops"
}

print(f"Testing Query: {payload['query']} with phase={phase_id}")
try:
    response = requests.post(url, headers=headers, json=payload, timeout=60)
    print(f"Status: {response.status_code}")
    print(f"Chatbot Response: {response.json().get('response')}")
except Exception as e:
    print(f"Failed: {e}")
