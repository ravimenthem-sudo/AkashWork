from typing import List, Dict, Any, Optional
from services.attendance_service import logger

class PayslipService:
    def __init__(self, supabase_client):
        self.supabase = supabase_client

    def get_user_payslips(self, user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Fetch latest payslips for a user"""
        try:
            response = self.supabase.table("payslips")\
                .select("*")\
                .eq("user_id", user_id)\
                .order("year", desc=True)\
                .order("month", desc=True)\
                .limit(limit)\
                .execute()
            return response.data
        except Exception as e:
            logger.error(f"Error fetching payslips: {e}")
            return []

    def get_latest_payslip(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get the most recent payslip"""
        payslips = self.get_user_payslips(user_id, limit=1)
        return payslips[0] if payslips else None
