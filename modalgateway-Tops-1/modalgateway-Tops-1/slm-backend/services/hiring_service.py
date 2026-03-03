class HiringService:
    def __init__(self, supabase):
        self.supabase = supabase

    def get_candidates(self, limit=10):
        try:
            # We assume a 'candidates' table exists or we fall back to mock data
            res = self.supabase.table("candidates").select("*").limit(limit).execute()
            if res.data:
                return res.data
        except Exception as e:
            print(f"[HIRING SERVICE] Error fetching candidates: {e}")
        
        # Mock data fallback for demo if table doesn't exist
        return [
            {"id": 1, "name": "John Doe", "role": "Frontend Engineer", "stage": "Interview", "score": 85},
            {"id": 2, "name": "Jane Smith", "role": "Product Executive", "stage": "Screening", "score": 92},
            {"id": 3, "name": "Mike Ross", "role": "Legal Advisor", "stage": "Offer", "score": 78}
        ]

    def add_candidate(self, data):
        try:
            res = self.supabase.table("candidates").insert(data).execute()
            return res.data
        except Exception as e:
            print(f"[HIRING SERVICE] Error adding candidate: {e}")
            return None
