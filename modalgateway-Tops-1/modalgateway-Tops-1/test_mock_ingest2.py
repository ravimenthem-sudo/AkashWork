import requests

payload = {
    "doc_id": "test_task1",
    "org_id": "test-org",
    "project_id": "test-project",
    "task_id": "1234",
    "phase": "requirement_refiner",
    "text": "test content",
    "metadata": {
        "title": "Task Guidance: Mock Task (requirement_refiner)",
        "task_id": "1234",
        "phase": "requirement_refiner",
        "source": "task_spec"
    }
}

try:
    print("Posting to http://127.0.0.1:8035/api/chatbot/ingest")
    res = requests.post("http://127.0.0.1:8035/api/chatbot/ingest", json=payload, timeout=10)
    print(f"Status Code: {res.status_code}")
    print(f"Response: {res.text}")
except Exception as e:
    print(f"Error: {e}")
