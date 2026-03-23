import os
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("TALENTOPS_SUPABASE_URL")
key = os.getenv("TALENTOPS_SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

def search_content(query):
    print(f"\n🔍 Searching for: '{query}'")
    try:
        response = requests.get(f"{url}/rest/v1/document_chunks?content=ilike.*{query}*&select=content,document_id", headers=headers)
        if response.status_code == 200:
            chunks = response.json()
            print(f"Found {len(chunks)} chunks.")
            for i, c in enumerate(chunks[:5]):
                # Get doc title
                doc_id = c['document_id']
                doc_res = requests.get(f"{url}/rest/v1/documents?id=eq.{doc_id}&select=title", headers=headers)
                title = doc_res.json()[0]['title'] if doc_res.status_code == 200 and doc_res.json() else "Unknown"
                
                print(f"\n--- Chunk {i+1} (Doc: {title} | ID: {doc_id}) ---")
                print(c['content'][:500] + "...")
        else:
            print(f"Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    search_content("chatbot")
    search_content("HR questions")
    search_content("HR Persona")
    search_content("Leave Policy")
    search_content("Exit Policy")
