import os
import sys
import django
import requests

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NutriCore.settings')
django.setup()

from django.conf import settings

supabase_url = settings.SUPABASE_URL
service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY
bucket_name = settings.SUPABASE_STORAGE_BUCKET

print("Auditing Supabase Storage bucket:", bucket_name)

headers = {
    "Authorization": f"Bearer {service_role_key}",
    "apikey": service_role_key,
    "Content-Type": "application/json",
}

folders = ["profiles", "foods", "recipes", "exercises", "exercise_images", "muscles", "submuscles", ""]

for folder in folders:
    url = f"{supabase_url}/storage/v1/object/list/{bucket_name}"
    payload = {
        "prefix": folder,
        "limit": 100,
        "offset": 0,
        "sortBy": {"column": "name", "order": "asc"}
    }
    resp = requests.post(url, json=payload, headers=headers)
    if resp.status_code == 200:
        items = resp.json()
        print(f"Folder '{folder}': {len(items)} items found")
        for item in items[:15]:
            meta = item.get('metadata') or {}
            size = meta.get('size', 'dir' if item.get('id') is None else 0)
            print(f"   - {item.get('name')} ({size} bytes, created: {item.get('created_at')})")
        if len(items) > 15:
            print(f"   ... and {len(items) - 15} more items.")
    else:
        print(f"Folder '{folder}': error {resp.status_code} - {resp.text}")
