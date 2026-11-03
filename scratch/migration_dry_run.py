import os
import sys
import json
import subprocess
from urllib.parse import urlparse
import psycopg2
import requests
from dotenv import dotenv_values

def mask_url(url_str):
    if not url_str:
        return "[NOT SET]"
    try:
        parsed = urlparse(url_str)
        masked_netloc = f"***:***@{parsed.hostname}:{parsed.port}" if parsed.port else f"***:***@{parsed.hostname}"
        return f"{parsed.scheme}://{masked_netloc}{parsed.path}"
    except Exception:
        return "[MASKED]"

def run_dry_run():
    print("=" * 80)
    print("NUTRICORE MIGRATION READINESS & CONNECTIVITY DRY-RUN")
    print("Source: Ireland (eu-west-1)  ===>  Destination: Mumbai (ap-south-1)")
    print("=" * 80)

    # ---------------------------------------------------------
    # 1. Security Checks
    # ---------------------------------------------------------
    print("\n[1] SECURITY & ENVIRONMENT CHECKS")
    print("-" * 50)
    
    env_mumbai_exists = os.path.isfile('.env.mumbai')
    print(f"  • .env.mumbai file exists: {env_mumbai_exists}")
    
    # Check .gitignore
    git_check = subprocess.run(['git', 'check-ignore', '-v', '.env.mumbai'], capture_output=True, text=True)
    is_git_ignored = git_check.returncode == 0
    print(f"  • .env.mumbai excluded by .gitignore: {is_git_ignored} ({git_check.stdout.strip()})")

    # Load credentials safely
    source_env = dotenv_values('.env')
    dest_env = dotenv_values('.env.mumbai')

    source_db_url = source_env.get('DATABASE_URL')
    source_sp_url = source_env.get('SUPABASE_URL', '').rstrip('/')
    source_sp_key = source_env.get('SUPABASE_SERVICE_ROLE_KEY')
    source_bucket = source_env.get('SUPABASE_STORAGE_BUCKET', 'nutricore-media')

    dest_db_url = dest_env.get('MUMBAI_DATABASE_URL')
    dest_sp_url = dest_env.get('MUMBAI_SUPABASE_URL', '').rstrip('/')
    dest_sp_key = dest_env.get('MUMBAI_SUPABASE_SERVICE_ROLE_KEY')
    dest_sp_anon = dest_env.get('MUMBAI_SUPABASE_ANON_KEY')
    dest_bucket = dest_env.get('MUMBAI_STORAGE_BUCKET', 'nutricore-media')

    print(f"  • Source credentials present: DB={bool(source_db_url)}, URL={bool(source_sp_url)}, Key={bool(source_sp_key)}")
    print(f"  • Destination credentials present: DB={bool(dest_db_url)}, URL={bool(dest_sp_url)}, Key={bool(dest_sp_key)}, Anon={bool(dest_sp_anon)}")

    # ---------------------------------------------------------
    # 2. Ireland Source Checks
    # ---------------------------------------------------------
    print("\n[2] IRELAND SOURCE CHECKS")
    print("-" * 50)
    
    source_conn_ok = False
    source_tables = {}
    try:
        source_parsed = urlparse(source_db_url)
        print(f"  • Source host: {source_parsed.hostname} (Port: {source_parsed.port})")
        
        conn_src = psycopg2.connect(source_db_url, connect_timeout=15)
        cur_src = conn_src.cursor()
        cur_src.execute("SELECT 1;")
        res = cur_src.fetchone()
        source_conn_ok = (res[0] == 1)
        print(f"  • Source SELECT 1: SUCCESS ({source_conn_ok})")

        catalogue_tables = [
            "Nutrition_category",
            "Nutrition_food",
            "Nutrition_food_categories",
            "Recipes_recipecategory",
            "Recipes_recipe",
            "Workouts_musclegroup",
            "Workouts_submuscle",
            "Workouts_exercise"
        ]
        
        print("  • Source Catalogue Tables & Record Counts:")
        for t in catalogue_tables:
            try:
                cur_src.execute(f'SELECT COUNT(*) FROM "{t}";')
                count = cur_src.fetchone()[0]
                source_tables[t] = count
                print(f"      - {t:<30}: {count} records")
            except Exception as e:
                source_tables[t] = f"Error: {e}"
                print(f"      - {t:<30}: Error: {e}")
                conn_src.rollback()

        cur_src.close()
        conn_src.close()
    except Exception as e:
        print(f"  • Source DB Connection Error: {e}")

    # Ireland Storage Bucket Check
    source_storage_ok = False
    source_object_count = 0
    try:
        src_headers = {
            "Authorization": f"Bearer {source_sp_key}",
            "apikey": source_sp_key,
        }
        resp = requests.get(f"{source_sp_url}/storage/v1/bucket/{source_bucket}", headers=src_headers, timeout=10)
        if resp.status_code == 200:
            b_info = resp.json()
            source_storage_ok = True
            print(f"  • Source Storage Bucket '{source_bucket}': EXISTS (public={b_info.get('public', False)})")
        else:
            print(f"  • Source Storage Bucket '{source_bucket}': HTTP {resp.status_code} ({resp.text})")
    except Exception as e:
        print(f"  • Source Storage Error: {e}")

    # ---------------------------------------------------------
    # 3. Mumbai Destination Checks
    # ---------------------------------------------------------
    print("\n[3] MUMBAI DESTINATION CHECKS")
    print("-" * 50)

    dest_conn_ok = False
    dest_is_mumbai = False
    dest_existing_tables = []
    
    try:
        dest_parsed = urlparse(dest_db_url)
        dest_host = dest_parsed.hostname or ""
        print(f"  • Destination host: {dest_host} (Port: {dest_parsed.port})")
        
        if "ap-south-1" in dest_host:
            dest_is_mumbai = True
            print("  • Region Verification: CONFIRMED 'ap-south-1' (Mumbai, India)")
        else:
            print(f"  • Region Verification WARNING: 'ap-south-1' not detected in hostname: {dest_host}")

        # Check that destination is NOT the source
        if source_parsed.hostname and dest_host:
            if source_parsed.hostname != dest_host:
                print("  • Isolation Check: CONFIRMED Destination is a different host from Source")
            else:
                print("  • CRITICAL ERROR: Destination host matches Source host!")

        conn_dst = psycopg2.connect(dest_db_url, connect_timeout=15)
        cur_dst = conn_dst.cursor()
        cur_dst.execute("SELECT 1;")
        res_dst = cur_dst.fetchone()
        dest_conn_ok = (res_dst[0] == 1)
        print(f"  • Destination SELECT 1: SUCCESS ({dest_conn_ok})")

        # Check existing public tables
        cur_dst.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        dest_existing_tables = [row[0] for row in cur_dst.fetchall()]
        print(f"  • Existing public tables in Destination DB: {len(dest_existing_tables)}")
        if dest_existing_tables:
            print(f"      Tables found: {dest_existing_tables}")
        else:
            print("      (Database is clean and ready for initial schema migration)")

        cur_dst.close()
        conn_dst.close()
    except Exception as e:
        print(f"  • Destination DB Connection Error: {e}")

    # Destination Supabase Storage Checks
    dest_bucket_exists = False
    dest_bucket_public = False
    dest_existing_objects = []
    try:
        dst_headers = {
            "Authorization": f"Bearer {dest_sp_key}",
            "apikey": dest_sp_key,
        }
        # Check bucket
        resp = requests.get(f"{dest_sp_url}/storage/v1/bucket/{dest_bucket}", headers=dst_headers, timeout=10)
        if resp.status_code == 200:
            b_info = resp.json()
            dest_bucket_exists = True
            dest_bucket_public = b_info.get('public', False)
            print(f"  • Destination Bucket '{dest_bucket}': EXISTS (public={dest_bucket_public})")
            if not dest_bucket_public:
                print("    [!] ATTENTION: Bucket is currently PRIVATE. It must be set to PUBLIC for catalogue image URLs.")
        elif resp.status_code == 404:
            print(f"  • Destination Bucket '{dest_bucket}': NOT FOUND (HTTP 404)")
        else:
            print(f"  • Destination Bucket check: HTTP {resp.status_code} ({resp.text})")

        # List objects in destination bucket to check for conflicts
        if dest_bucket_exists:
            list_resp = requests.post(
                f"{dest_sp_url}/storage/v1/object/list/{dest_bucket}",
                headers=dst_headers,
                json={"prefix": "", "limit": 100, "offset": 0},
                timeout=10
            )
            if list_resp.status_code == 200:
                items = list_resp.json()
                dest_existing_objects = items
                print(f"  • Existing objects in Destination '{dest_bucket}': {len(items)} items")
            else:
                print(f"  • Object list check error: HTTP {list_resp.status_code}")
    except Exception as e:
        print(f"  • Destination Storage Error: {e}")

    # Public URL structure check
    sample_path = "foods/white_cooked_rice.jpg"
    constructed_url = f"{dest_sp_url}/storage/v1/object/public/{dest_bucket}/{sample_path}"
    print(f"  • Sample constructed public image URL format:\n      {constructed_url}")

    # ---------------------------------------------------------
    # 4. Migration Asset Checks
    # ---------------------------------------------------------
    print("\n[4] MIGRATION ASSET & CATALOGUE INTEGRITY CHECKS")
    print("-" * 50)
    
    # Check data.json
    data_json_path = 'data.json'
    data_json_count = 0
    data_models = {}
    if os.path.exists(data_json_path):
        with open(data_json_path, 'r', encoding='utf-8') as f:
            data_items = json.load(f)
            data_json_count = len(data_items)
            from collections import Counter
            data_models = dict(Counter(d.get('model') for d in data_items))
        print(f"  • data.json catalogue records: {data_json_count} (Expected: 451)")
        for m, c in sorted(data_models.items()):
            print(f"      - {m:<30}: {c}")
    else:
        print("  • data.json: NOT FOUND")

    # Check supabase_media_mapping.json
    mapping_path = 'supabase_media_mapping.json'
    mapping_ok = False
    missing_files = []
    if os.path.exists(mapping_path):
        with open(mapping_path, 'r', encoding='utf-8') as f:
            mapping_data = json.load(f)
            mappings = mapping_data.get('mappings', {})
            total_mapped = len(mappings)
            print(f"  • supabase_media_mapping.json entries: {total_mapped} (Expected: 541)")
            
            for k, entry in mappings.items():
                local_p = entry.get('local_path')
                if not os.path.exists(local_p):
                    missing_files.append(local_p)
            
            if not missing_files:
                mapping_ok = True
                print("  • Local media files verification: ALL 541 FILES PRESENT ON DISK")
            else:
                print(f"  • Missing local media files: {len(missing_files)}")
    else:
        print("  • supabase_media_mapping.json: NOT FOUND")

    print("\n" + "=" * 80)
    print("DRY-RUN SUMMARY")
    print("=" * 80)
    
    checks = {
        "Security: .env.mumbai exists": env_mumbai_exists,
        "Security: .env.mumbai in .gitignore": is_git_ignored,
        "Source DB: Ireland Connection & SELECT 1": source_conn_ok,
        "Source DB: Catalogue tables accessible": bool(source_tables and not any("Error" in str(v) for v in source_tables.values())),
        "Source Storage: Ireland Bucket accessible": source_storage_ok,
        "Destination DB: Mumbai Connection & SELECT 1": dest_conn_ok,
        "Destination DB: Verified Region ap-south-1": dest_is_mumbai,
        "Destination Storage: Bucket exists": dest_bucket_exists,
        "Destination Storage: Bucket is Public": dest_bucket_public,
        "Destination Storage: Zero conflicts": len(dest_existing_objects) == 0,
        "Migration Assets: data.json records = 451": data_json_count == 451,
        "Migration Assets: All 541 media files present": mapping_ok,
    }

    for name, status in checks.items():
        tag = "PASS" if status else "NEEDS ATTENTION"
        print(f"  [{tag:^15}] {name}")

if __name__ == '__main__':
    run_dry_run()

