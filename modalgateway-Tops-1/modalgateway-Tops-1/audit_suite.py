import requests
import json
import time
import asyncio
import aiohttp
import psutil
import os
import sys
from datetime import datetime
import statistics

BASE_URL = "http://localhost:8035"
TALENTOPS_USER_ID = "3fad4308-573f-4847-b904-2906fa67a468" # Real Profile ID from existing tests
COHORT_USER_ID = "test-cohort-user" # Placeholder if not available

class AuditSuite:
    def __init__(self):
        self.results = {
            "functional": [],
            "database": [],
            "load": {},
            "performance": {},
            "stress": [],
            "memory": {}
        }
        self.logs = []

    def log(self, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        msg = f"[{timestamp}] {message}"
        print(msg)
        self.logs.append(msg)

    async def run_functional_tests(self):
        self.log("Starting Functional Regression Testing...")
        
        # 1. Health Checks
        endpoints = ["/health", "/slm/health", "/llm/health", "/rag/health"]
        for ep in endpoints:
            try:
                start = time.time()
                resp = requests.get(f"{BASE_URL}{ep}", timeout=5)
                duration = time.time() - start
                status = "PASS" if resp.status_code == 200 else "FAIL"
                self.results["functional"].append({
                    "test": f"Health Check: {ep}",
                    "status": status,
                    "code": resp.status_code,
                    "duration": f"{duration:.3f}s",
                    "response": resp.json()
                })
                self.log(f"Health Check {ep}: {status} ({duration:.3f}s)")
            except Exception as e:
                self.results["functional"].append({"test": f"Health Check: {ep}", "status": "FAIL", "error": str(e)})

        # 2. SLM Chat - Basic Greeting
        payload = {
            "query": "Hello",
            "user_id": TALENTOPS_USER_ID,
            "app_name": "talentops",
            "context": {"role": "employee"}
        }
        try:
            resp = requests.post(f"{BASE_URL}/slm/chat", json=payload, timeout=15)
            self.results["functional"].append({
                "test": "SLM Chat: Basic Greeting",
                "status": "PASS" if resp.status_code == 200 else "FAIL",
                "response": resp.json()
            })
        except Exception as e:
            self.results["functional"].append({"test": "SLM Chat: Basic Greeting", "status": "FAIL", "error": str(e)})

        # 3. SLM Chat - Task Creation (Simulation of intent)
        payload["query"] = "Show my tasks"
        try:
            resp = requests.post(f"{BASE_URL}/slm/chat", json=payload, timeout=15)
            self.results["functional"].append({
                "test": "SLM Chat: Show Tasks",
                "status": "PASS" if resp.status_code == 200 else "FAIL",
                "response": resp.json()
            })
        except Exception as e:
            self.results["functional"].append({"test": "SLM Chat: Show Tasks", "status": "FAIL", "error": str(e)})

        # 4. Multi-app switching
        for app in ["talentops", "cohort"]:
            payload = {
                "query": "Check status",
                "user_id": TALENTOPS_USER_ID if app == "talentops" else COHORT_USER_ID,
                "app_name": app,
                "context": {"role": "employee"}
            }
            try:
                resp = requests.post(f"{BASE_URL}/slm/chat", json=payload, timeout=15)
                data = resp.json()
                is_available = "unavailable" not in data.get("response", "").lower()
                status = "PASS" if resp.status_code == 200 else "FAIL"
                self.results["functional"].append({
                    "test": f"App Switching: {app}",
                    "status": status,
                    "available": is_available,
                    "response": data
                })
                self.log(f"App Switching {app}: {status} (Available: {is_available})")
            except Exception as e:
                self.results["functional"].append({"test": f"App Switching: {app}", "status": "FAIL", "error": str(e)})

    async def run_load_test(self, concurrent_users):
        self.log(f"Starting Load Test with {concurrent_users} concurrent users...")
        url = f"{BASE_URL}/slm/chat"
        payload = {
            "query": "Show my notifications",
            "user_id": TALENTOPS_USER_ID,
            "app_name": "talentops",
            "context": {"role": "employee"}
        }
        
        latencies = []
        errors = 0
        
        async with aiohttp.ClientSession() as session:
            tasks = []
            for _ in range(concurrent_users):
                tasks.append(self.fetch_chat(session, url, payload))
            
            start_time = time.time()
            responses = await asyncio.gather(*tasks)
            total_duration = time.time() - start_time
            
            for status, duration in responses:
                if status == 200:
                    latencies.append(duration)
                else:
                    errors += 1
        
        if latencies:
            avg_latency = statistics.mean(latencies)
            p95_latency = statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else max(latencies)
        else:
            avg_latency = p95_latency = 0
            
        result = {
            "concurrent_users": concurrent_users,
            "avg_latency": f"{avg_latency:.3f}s",
            "p95_latency": f"{p95_latency:.3f}s",
            "error_rate": f"{(errors/concurrent_users)*100:.1f}%",
            "total_duration": f"{total_duration:.3f}s"
        }
        self.results["load"][f"{concurrent_users}_users"] = result
        self.log(f"Load Test ({concurrent_users} users): Avg {avg_latency:.3f}s, P95 {p95_latency:.3f}s, Errors {errors}")

    async def fetch_chat(self, session, url, payload):
        start = time.time()
        try:
            async with session.post(url, json=payload, timeout=20) as response:
                return response.status, time.time() - start
        except Exception:
            return 500, time.time() - start

    def run_stress_tests(self):
        self.log("Starting Stress & Edge Case Testing...")
        
        # 1. Invalid app_name
        payload = {"query": "test", "app_name": "invalid_app_xyz"}
        try:
            resp = requests.post(f"{BASE_URL}/slm/chat", json=payload, timeout=5)
            self.results["stress"].append({"test": "Invalid app_name", "code": resp.status_code, "pass": resp.status_code < 500})
        except: pass

        # 2. Large payload
        payload = {"query": "A" * 10000, "app_name": "talentops"}
        try:
            resp = requests.post(f"{BASE_URL}/slm/chat", json=payload, timeout=10)
            self.results["stress"].append({"test": "Large Payload (10k chars)", "code": resp.status_code, "pass": resp.status_code == 200})
        except: pass

        # 3. Malformed JSON
        try:
            resp = requests.post(f"{BASE_URL}/slm/chat", data="not a json", headers={"Content-Type": "application/json"}, timeout=5)
            self.results["stress"].append({"test": "Malformed JSON", "code": resp.status_code, "pass": resp.status_code == 422})
        except: pass

    def capture_metrics(self):
        process = psutil.Process(os.getpid())
        mem = process.memory_info().rss / (1024 * 1024) # MB
        cpu = psutil.cpu_percent(interval=None)
        return {"memory_mb": mem, "cpu_percent": cpu}

    def run_benchmarks(self):
        self.log("Running Performance Benchmarks...")
        # Cold start mock: First request after script start
        start_time = time.time()
        requests.get(f"{BASE_URL}/health")
        latency = time.time() - start_time
        self.results["performance"]["first_request_latency"] = f"{latency:.3f}s"
        
        # Measure overhead: Average of 5 health checks
        latencies = []
        for _ in range(5):
            s = time.time()
            requests.get(f"{BASE_URL}/health")
            latencies.append(time.time() - s)
        self.results["performance"]["avg_health_latency"] = f"{statistics.mean(latencies):.3f}s"

    async def run_all(self):
        self.results["metrics_before"] = self.capture_metrics()
        
        await self.run_functional_tests()
        
        self.run_benchmarks()
        
        await self.run_load_test(10)
        await self.run_load_test(50)
        await self.run_load_test(100)
        
        self.run_stress_tests()
        
        self.results["metrics_after"] = self.capture_metrics()
        self.log("All tests completed.")
        
        return self.results

if __name__ == "__main__":
    suite = AuditSuite()
    loop = asyncio.get_event_loop()
    results = loop.run_until_complete(suite.run_all())
    
    with open("audit_results.json", "w") as f:
        json.dump(results, f, indent=4)
    
    with open("audit_logs.txt", "w") as f:
        f.write("\n".join(suite.logs))
