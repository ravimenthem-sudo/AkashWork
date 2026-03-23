"""Check which Llama models are available on Together API"""
import os
from dotenv import load_dotenv
load_dotenv()

from together import Together
client = Together(api_key=os.getenv("TOGETHER_API_KEY"))

models = client.models.list()
llama_models = [m.id for m in models if 'llama' in m.id.lower() and ('instruct' in m.id.lower() or 'turbo' in m.id.lower())]
print("Available Llama Instruct/Turbo models:")
for m in sorted(llama_models):
    # Only show official meta-llama models
    if m.startswith('meta-llama'):
        print(f"  - {m}")
