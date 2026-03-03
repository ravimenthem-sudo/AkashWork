import logging
import httpx
import asyncio
from contextvars import ContextVar
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class SimpleSupabaseClient:
    def __init__(self, url, key):
        self.url = url
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    
    def table(self, name):
        return SimpleSupabaseQuery(self.url, dict(self.headers), name)
    
    async def rpc(self, name, params):
        url = f"{self.url}/rest/v1/rpc/{name}"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, headers=self.headers, json=params)
                if resp.status_code == 200:
                    return type('Response', (), {'data': resp.json()})()
                return type('Response', (), {'data': []})()
        except Exception as e:
            logger.error(f"Supabase RPC Error: {e}")
            return type('Response', (), {'data': []})()

class SimpleSupabaseQuery:
    def __init__(self, base_url, headers, table):
        self.url = f"{base_url}/rest/v1/{table}"
        self.headers = headers
        self.params = {}
        self.method = "GET"
        self.json_data = None

    def select(self, *columns):
        self.method = "GET"
        cols = ",".join(columns) if columns else "*"
        self.params["select"] = cols
        return self

    def eq(self, column, value):
        self.params[f"{column}"] = f"eq.{value}"
        return self

    def in_(self, column, values):
        val_str = ",".join([str(v) for v in values])
        self.params[f"{column}"] = f"in.({val_str})"
        return self

    def neq(self, column, value):
        self.params[f"{column}"] = f"neq.{value}"
        return self

    def ilike(self, column, value):
        self.params[f"{column}"] = f"ilike.{value}"
        return self

    def limit(self, count):
        self.headers["Range-Unit"] = "items"
        self.headers["Range"] = f"0-{count-1}"
        self.params["limit"] = count
        return self

    def order(self, column, desc=False):
        direction = "desc" if desc else "asc"
        self.params["order"] = f"{column}.{direction}"
        return self

    def insert(self, data):
        self.method = "POST"
        self.json_data = data
        self.headers["Prefer"] = "return=representation"
        return self

    def update(self, data):
        self.method = "PATCH"
        self.json_data = data
        self.headers["Prefer"] = "return=representation"
        return self

    async def execute(self):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                if self.method == "GET":
                    resp = await client.get(self.url, headers=self.headers, params=self.params)
                elif self.method == "POST":
                    resp = await client.post(self.url, headers=self.headers, json=self.json_data, params=self.params)
                elif self.method == "PATCH":
                    resp = await client.patch(self.url, headers=self.headers, json=self.json_data, params=self.params)
                
                if resp.status_code >= 400:
                    try:
                        err = resp.json()
                        err_msg = err.get('message', err.get('details', resp.text))
                    except:
                        err_msg = resp.text
                    logger.error(f"❌ SUPABASE ERROR [{resp.status_code}]: {err_msg} | URL: {self.url}")
                    return type('Response', (), {'data': None, 'error': err_msg, 'status_code': resp.status_code})()
                
                return type('Response', (), {'data': resp.json(), 'error': None, 'status_code': resp.status_code})()
        except Exception as e:
            logger.error(f"Supabase Client Error: {e}")
            return type('Response', (), {'data': None, 'error': str(e), 'status_code': 500})()

# --- Internal Client State ---
talentops_supabase = None
cohort_supabase = None

# Context variable to hold the client for the current request
current_supabase_client: ContextVar[Optional[SimpleSupabaseClient]] = ContextVar('current_supabase_client', default=None)

class SupabaseProxy:
    """Proxies all attributes to the client in the current request context."""
    def __getattr__(self, name):
        client = current_supabase_client.get()
        if client is None:
            # Fallback to talentops if none set (preserving backward compatibility)
            if talentops_supabase:
                return getattr(talentops_supabase, name)
            raise RuntimeError("No Supabase client is set for this request context and talentops_supabase is not initialized.")
        return getattr(client, name)

# This global 'supabase' object dynamically points to the correct DB per request.
supabase = SupabaseProxy()

def init_db(talentops_url, talentops_key, cohort_url=None, cohort_key=None):
    """Initialize DB clients with provided credentials."""
    global talentops_supabase, cohort_supabase
    
    talentops_supabase = SimpleSupabaseClient(talentops_url, talentops_key)
    
    if cohort_url and cohort_key:
        cohort_supabase = SimpleSupabaseClient(cohort_url, cohort_key)
        logger.info("Database initialized with TalentOps and Cohort clients.")
    else:
        cohort_supabase = None
        logger.info("Database initialized with TalentOps client only (Cohort inactive).")
    
    # Set default context
    current_supabase_client.set(talentops_supabase)

def select_client(app_name: str) -> Optional[str]:
    """Centralized DB client selection."""
    if app_name == "cohort":
        if cohort_supabase is None:
            logger.error("Cohort app requested but cohort client is not initialized.")
            return "COHORT_UNAVAILABLE"
        current_supabase_client.set(cohort_supabase)
    else:
        if talentops_supabase is None:
             logger.error("TalentOps client is not initialized.")
             return "TALENTOPS_UNAVAILABLE"
        current_supabase_client.set(talentops_supabase)
    return None  # None = success, no error
