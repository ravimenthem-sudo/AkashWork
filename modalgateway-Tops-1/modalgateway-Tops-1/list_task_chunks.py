import os
import requests
import sys
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("TALENTOPS_SUPABASE_URL")
key = os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

def list_chunks(task_id):
    try:
        # Query document_chunks by task_id
        query_url = f"{url}/rest/v1/document_chunks?task_id=eq.{task_id}&select=content,document_id"
        response = requests.get(query_url, headers=headers)
        
        if response.status_code == 200:
            chunks = response.json()
            if not chunks:
                print(f"No chunks found for Task ID: {task_id}")
                return
            
            print(f"\n{'='*60}")
            print(f"Found {len(chunks)} chunks for Task ID: {task_id}")
            print(f"{'='*60}")
            
            for i, c in enumerate(chunks):
                print(f"\n[Chunk {i+1}] (Doc: {c['document_id']})")
                print("-" * 40)
                print(c['content'])
                print("-" * 40)
        else:
            print(f"Error fetching chunks: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python list_task_chunks.py <task_id>")
        sys.exit(1)
    
    list_chunks(sys.argv[1])
