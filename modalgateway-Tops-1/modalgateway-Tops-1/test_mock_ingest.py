import subprocess
import requests

payload = {
    "doc_id": "task_1234_requirement_refiner",
    "org_id": "test-org",
    "project_id": "test-project",
    "task_id": "1234",
    "phase": "requirement_refiner",
    "file_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    "metadata": {
        "title": "Task Guidance: Mock Task (requirement_refiner)",
        "task_id": "1234",
        "phase": "requirement_refiner",
        "source": "task_spec"
    }
}

print("Posting to http://localhost:8035/api/chatbot/ingest")
res = requests.post("http://localhost:8035/api/chatbot/ingest", json=payload)
print(f"Status Code: {res.status_code}")
print(f"Response: {res.text}")
