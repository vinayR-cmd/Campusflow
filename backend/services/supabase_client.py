from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

supabase = get_supabase()
