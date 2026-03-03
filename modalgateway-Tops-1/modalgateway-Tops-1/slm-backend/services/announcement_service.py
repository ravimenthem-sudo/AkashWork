from typing import List, Dict, Any, Optional
from postgrest import APIResponse
from services.attendance_service import logger # Reuse logger

class AnnouncementService:
    def __init__(self, supabase_client):
        self.supabase = supabase_client

    def get_announcements(self, org_id: str, status: str = "active") -> List[Dict[str, Any]]:
        """Get announcements for an organization"""
        try:
            query = self.supabase.table("announcements").select("*").eq("org_id", org_id)
            if status:
                query = query.eq("status", status)
            
            response = query.order("created_at", desc=True).execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching announcements: {e}")
            return []

    def get_completed_announcements(self, org_id: str) -> List[Dict[str, Any]]:
        """Get archived/completed announcements"""
        return self.get_announcements(org_id, status="archived")
