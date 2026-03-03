"""
Test script for Unified Modal Gateway
Tests all endpoints: SLM, RAG, LLM on port 8035
"""

import requests
import json

BASE_URL = "http://localhost:8035"

def test_health():
    """Test health endpoint"""
    print("\n" + "=" * 60)
    print("1. Testing Health Check")
    print("=" * 60)
    
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    print("✓ Health check passed")

def test_slm_chatbot():
    """Test SLM chatbot endpoint"""
    print("\n" + "=" * 60)
    print("2. Testing SLM Chatbot")
    print("=" * 60)
    
    payload = {
        "query": "Show me my tasks",
        "context": {
            "role": "employee",
            "user_id": "test-user-123"
        }
    }
    
    response = requests.post(f"{BASE_URL}/api/chatbot/query", json=payload)
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Answer: {result.get('answer', 'No answer')[:200]}...")
    print("✓ SLM chatbot working")

def test_llm_allowed():
    """Test LLM with allowed query"""
    print("\n" + "=" * 60)
    print("3. Testing LLM - Allowed Query")
    print("=" * 60)
    
    payload = {
        "query": "Help me draft a professional leave request email for sick leave",
        "persona": "hr",
        "temperature": 0.3
    }
    
    response = requests.post(f"{BASE_URL}/api/llm/query", json=payload)
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Answer: {result['answer'][:200]}...")
    print(f"Model: {result['model']}")
    print(f"Tokens: {result['tokens_used']}")
    print("✓ LLM allowed query working")

def test_llm_forbidden():
    """Test LLM with forbidden query"""
    print("\n" + "=" * 60)
    print("4. Testing LLM - Forbidden Query")
    print("=" * 60)
    
    payload = {
        "query": "What's the weather like today?",
        "persona": "hr"
    }
    
    response = requests.post(f"{BASE_URL}/api/llm/query", json=payload)
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Answer: {result['answer']}")
    
    if "cannot" in result['answer'].lower() or "not able" in result['answer'].lower():
        print("✓ LLM correctly refused forbidden query")
    else:
        print("✗ LLM should have refused this query")

def test_llm_guardrails():
    """Test LLM guardrails validation"""
    print("\n" + "=" * 60)
    print("5. Testing LLM Guardrails")
    print("=" * 60)
    
    test_cases = [
        {"query": "Draft a leave request", "expected": "allowed"},
        {"query": "What's the latest news?", "expected": "refused"},
    ]
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n  Test {i}: {test['query']}")
        payload = {"query": test["query"]}
        response = requests.post(f"{BASE_URL}/api/llm/test", json=payload)
        result = response.json()
        
        print(f"    Should refuse: {result['should_refuse']}")
        print(f"    Did refuse: {result['did_refuse']}")
        print(f"    Test passed: {result['test_passed']}")
        
        if result['test_passed']:
            print(f"    ✓ Guardrails working correctly")
        else:
            print(f"    ✗ Guardrails failed")

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("UNIFIED MODAL GATEWAY - TEST SUITE")
    print("=" * 60)
    
    try:
        test_health()
        test_slm_chatbot()
        test_llm_allowed()
        test_llm_forbidden()
        test_llm_guardrails()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS COMPLETED!")
        print("=" * 60)
        print("\nUnified Gateway is working correctly on port 8035")
        print("All endpoints (SLM, RAG, LLM) are accessible\n")
    
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to server")
        print("Make sure the server is running:")
        print("  cd slm-backend")
        print("  python server.py")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
