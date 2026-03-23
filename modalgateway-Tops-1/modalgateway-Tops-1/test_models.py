"""Test different model names on Together API"""
import os
from dotenv import load_dotenv
load_dotenv()

from together import Together
client = Together(api_key=os.getenv("TOGETHER_API_KEY"))

models_to_test = [
    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    "meta-llama/Llama-3.1-8B-Instruct-Turbo",
    "meta-llama/Meta-Llama-3-8B-Instruct-Turbo",
    "meta-llama/Llama-3-8B-Instruct-Turbo",
    "meta-llama/Llama-3.2-3B-Instruct-Turbo",
    "meta-llama/Llama-3.3-70B-Instruct-Turbo",
]

for model in models_to_test:
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hi"}],
            max_tokens=5,
            temperature=0.0
        )
        print(f"✅ {model} -> {resp.choices[0].message.content}")
    except Exception as e:
        err_msg = str(e)[:80]
        print(f"❌ {model} -> {err_msg}")
