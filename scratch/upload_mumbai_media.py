import os
import sys
import time
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from dotenv import dotenv_values

def run_stage2():
    print("=" * 80)
    print("STAGE 2: NUTRICORE MEDIA MIGRATION TO MUMBAI SUPABASE STORAGE")
    print("=" * 80)

    # 1. Load credentials
    source_env = dotenv_values('.env')
    dest_env = dotenv_values('.env.mumbai')

    source_sp_url = source_env.get('SUPABASE_URL', '').rstrip('/')
    dest_sp_url = dest_env.get('MUMBAI_SUPABASE_URL', '').rstrip('/')
    dest_sp_key = dest_env.get('MUMBAI_SUPABASE_SERVICE_ROLE_KEY')
    dest_bucket = dest_env.get('MUMBAI_STORAGE_BUCKET', 'nutricore-media')

    if not dest_sp_url or not dest_sp_key:
        print("FATAL ERROR: Mumbai Supabase credentials not found in .env.mumbai! Aborting.")
        sys.exit(1)

    print(f"\n[1] Destination & Security Validation:")
    print(f"  • Destination Supabase URL: {dest_sp_url}")
    print(f"  • Destination Storage Bucket: {dest_bucket}")
    
    if source_sp_url and dest_sp_url == source_sp_url:
        print("FATAL ERROR: Destination URL matches Ireland Source URL! Aborting to protect source.")
        sys.exit(1)

    # Check bucket exists and is public
    headers = {
        "Authorization": f"Bearer {dest_sp_key}",
        "apikey": dest_sp_key,
    }

    bucket_res = requests.get(f"{dest_sp_url}/storage/v1/bucket/{dest_bucket}", headers=headers, timeout=10)
    if bucket_res.status_code != 200:
        print(f"FATAL ERROR: Bucket '{dest_bucket}' check failed with status {bucket_res.status_code}: {bucket_res.text}")
        sys.exit(1)

    bucket_info = bucket_res.json()
    is_public = bucket_info.get('public', False)
    print(f"  • Bucket '{dest_bucket}' exists: True (public={is_public})")
    if not is_public:
        print("FATAL ERROR: Bucket is not marked Public! Aborting.")
        sys.exit(1)

    # 2. Load and validate mapping
    mapping_file = 'supabase_media_mapping.json'
    if not os.path.exists(mapping_file):
        print(f"FATAL ERROR: Mapping file not found at {mapping_file}! Aborting.")
        sys.exit(1)

    with open(mapping_file, 'r', encoding='utf-8') as f:
        mapping_data = json.load(f)

    mappings = mapping_data.get('mappings', {})
    print(f"\n[2] Media Mapping Pre-flight:")
    print(f"  • Total mapped entries: {len(mappings)} (Expected: 541)")

    if len(mappings) != 541:
        print(f"FATAL ERROR: Expected 541 mappings, found {len(mappings)}! Aborting.")
        sys.exit(1)

    # Verify uniqueness of object paths and existence of all local files
    unique_paths = set()
    total_expected_bytes = 0
    folder_counts = {}
    items_to_upload = []

    for key, item in mappings.items():
        obj_path = item.get('object_path')
        local_path = item.get('local_path')
        expected_size = item.get('size_bytes')
        mime_type = item.get('mime_type')
        folder = item.get('folder')

        if obj_path in unique_paths:
            print(f"FATAL ERROR: Duplicate object path detected: {obj_path}! Aborting.")
            sys.exit(1)
        unique_paths.add(obj_path)

        if not os.path.exists(local_path):
            print(f"FATAL ERROR: Local file missing: {local_path}! Aborting.")
            sys.exit(1)

        actual_size = os.path.getsize(local_path)
        if actual_size != expected_size:
            print(f"FATAL ERROR: Size mismatch for {local_path}: expected {expected_size}, got {actual_size}! Aborting.")
            sys.exit(1)

        if 'profile' in folder.lower() or 'profile' in obj_path.lower():
            print(f"FATAL ERROR: Profile image found in upload queue: {obj_path}! Aborting.")
            sys.exit(1)

        folder_counts[folder] = folder_counts.get(folder, 0) + 1
        total_expected_bytes += actual_size
        items_to_upload.append(item)

    print("  • Folder breakdown to upload:")
    for f_name, f_cnt in sorted(folder_counts.items()):
        print(f"      - {f_name:<20}: {f_cnt:3d} files")
    print(f"  • Total files to upload: {len(items_to_upload)}")
    print(f"  • Total bytes to upload: {total_expected_bytes:,} bytes (~{total_expected_bytes/(1024*1024):.2f} MiB)")

    # 3. Pre-upload Bucket Empty / Conflict Check
    print(f"\n[3] Pre-upload Destination Conflict Check:")
    # Check all target folders
    target_prefixes = ["foods", "exercise_images", "muscles", "submuscles", "recipes", "static/images", "static", ""]
    for prefix in target_prefixes:
        res = requests.post(
            f"{dest_sp_url}/storage/v1/object/list/{dest_bucket}",
            headers=headers,
            json={"prefix": prefix, "limit": 100, "offset": 0},
            timeout=10
        )
        if res.status_code == 200:
            existing = res.json()
            # Filter out non-file items if any
            if existing:
                print(f"FATAL ERROR: Existing items detected in destination folder '{prefix}': {len(existing)} items! Aborting to prevent overwrite.")
                sys.exit(1)
        else:
            print(f"Warning: List check for prefix '{prefix}' returned status {res.status_code}")

    print("  • Verified: Destination bucket is completely clean (zero existing/conflicting objects).")

    # 4. Upload Execution
    print("\n" + "=" * 80)
    print("BEGINNING SAFE BATCHED UPLOAD (541 FILES)")
    print("=" * 80)

    upload_stats = {
        'success': 0,
        'failed': 0,
        'retries': 0,
        'bytes_uploaded': 0,
        'folder_uploaded': {},
    }

    def upload_single_file(item):
        obj_path = item['object_path']
        local_path = item['local_path']
        mime_type = item['mime_type']
        size = item['size_bytes']
        folder = item['folder']

        url = f"{dest_sp_url}/storage/v1/object/{dest_bucket}/{obj_path}"
        req_headers = {
            "Authorization": f"Bearer {dest_sp_key}",
            "apiKey": dest_sp_key,
            "Content-Type": mime_type,
            "x-upsert": "false"  # Explicitly do NOT overwrite
        }

        with open(local_path, 'rb') as f:
            file_bytes = f.read()

        max_retries = 3
        last_error = None
        for attempt in range(max_retries + 1):
            try:
                resp = requests.post(url, headers=req_headers, data=file_bytes, timeout=30)
                if resp.status_code in (200, 201):
                    return {'status': 'OK', 'item': item, 'retries': attempt}
                elif resp.status_code == 409:
                    return {'status': 'CONFLICT', 'item': item, 'error': f"Object already exists (HTTP 409)"}
                else:
                    last_error = f"HTTP {resp.status_code}: {resp.text}"
            except Exception as ex:
                last_error = str(ex)

            if attempt < max_retries:
                time.sleep(1.0 * (2 ** attempt))

        return {'status': 'FAILED', 'item': item, 'error': last_error, 'retries': max_retries}

    start_time = time.perf_counter()
    failed_items = []

    # Use 6 worker threads for clean, reliable throughput without rate limit pressure
    with ThreadPoolExecutor(max_workers=6) as executor:
        future_to_item = {executor.submit(upload_single_file, it): it for it in items_to_upload}
        completed_count = 0

        for future in as_completed(future_to_item):
            res = future.result()
            completed_count += 1
            item = res['item']

            if res['status'] == 'OK':
                upload_stats['success'] += 1
                upload_stats['bytes_uploaded'] += item['size_bytes']
                upload_stats['retries'] += res['retries']
                folder = item['folder']
                upload_stats['folder_uploaded'][folder] = upload_stats['folder_uploaded'].get(folder, 0) + 1
            else:
                upload_stats['failed'] += 1
                failed_items.append((item['object_path'], res.get('error')))

            if completed_count % 50 == 0 or completed_count == len(items_to_upload):
                pct = (completed_count / len(items_to_upload)) * 100
                print(f"  Progress: {completed_count:3d}/541 ({pct:5.1f}%) | Success: {upload_stats['success']} | Retries: {upload_stats['retries']} | Failed: {upload_stats['failed']}")

    duration = time.perf_counter() - start_time
    print(f"\n>>> Upload phase completed in {duration:.2f} seconds.")
    print(f"    Total Uploaded: {upload_stats['success']} / 541 files")
    print(f"    Total Bytes:    {upload_stats['bytes_uploaded']:,} bytes")
    print(f"    Retries Used:   {upload_stats['retries']}")
    print(f"    Failures:       {upload_stats['failed']}")

    if upload_stats['failed'] > 0:
        print(f"\nFATAL: {upload_stats['failed']} files failed to upload:")
        for path, err in failed_items:
            print(f"  - {path}: {err}")
        sys.exit(1)

    # 5. Comprehensive Post-Upload Verification
    print("\n" + "=" * 80)
    print("POST-UPLOAD DESTINATION VERIFICATION")
    print("=" * 80)

    # Helper function to list all objects with pagination
    def list_all_objects(prefix):
        all_objs = []
        offset = 0
        limit = 100
        while True:
            resp = requests.post(
                f"{dest_sp_url}/storage/v1/object/list/{dest_bucket}",
                headers=headers,
                json={"prefix": prefix, "limit": limit, "offset": offset, "sortBy": {"column": "name", "order": "asc"}},
                timeout=15
            )
            if resp.status_code != 200:
                print(f"Error listing prefix '{prefix}': HTTP {resp.status_code}")
                break
            items = resp.json()
            if not items:
                break
            all_objs.extend(items)
            if len(items) < limit:
                break
            offset += limit
        return all_objs

    destination_objects = {}
    prefixes_to_scan = ["foods", "exercise_images", "muscles", "submuscles", "recipes", "static/images"]
    for pfx in prefixes_to_scan:
        objs = list_all_objects(pfx)
        for obj in objs:
            # Reconstruct relative object path
            name = obj.get('name')
            full_path = f"{pfx}/{name}"
            destination_objects[full_path] = obj

    print(f"  • Total objects discovered via list API across all folders: {len(destination_objects)}")

    # Verify every mapping exists in destination objects
    missing_in_dest = []
    size_mismatches = []
    for key, item in mappings.items():
        obj_path = item['object_path']
        expected_size = item['size_bytes']
        dest_obj = destination_objects.get(obj_path)

        if not dest_obj:
            missing_in_dest.append(obj_path)
        else:
            meta = dest_obj.get('metadata') or {}
            dest_size = meta.get('size')
            if dest_size is not None and int(dest_size) != expected_size:
                size_mismatches.append((obj_path, expected_size, dest_size))

    print(f"  • Mapping entries matching destination objects: {541 - len(missing_in_dest)} / 541")
    print(f"  • Missing objects: {len(missing_in_dest)}")
    print(f"  • Size mismatches: {len(size_mismatches)}")

    # 6. Test Public HTTP Access (Representative Sampling)
    print("\n[6] Public HTTP Image URL Verification (Sampling Every Folder):")
    samples_per_folder = {
        'foods': 'foods/Chicken_Nuggets_Fried.jpg',
        'exercise_images': 'exercise_images/Incline_barbell_press.png',
        'muscles': 'muscles/back.jpeg',
        'submuscles': 'submuscles/Lats.png',
        'recipes': 'recipes/Chicken_Lettuce_Wraps.jpg',
        'static/images': 'static/images/Water_img.jpg',
    }

    public_tests_ok = True
    for folder, sample_path in samples_per_folder.items():
        public_url = f"{dest_sp_url}/storage/v1/object/public/{dest_bucket}/{sample_path}"
        expected_mime = mappings[sample_path]['mime_type']
        expected_sz = mappings[sample_path]['size_bytes']

        try:
            head_resp = requests.head(public_url, timeout=10)
            status_code = head_resp.status_code
            resp_content_type = head_resp.headers.get('Content-Type')
            resp_content_len = int(head_resp.headers.get('Content-Length', 0))

            type_match = resp_content_type == expected_mime
            len_match = resp_content_len == expected_sz
            url_ok = (status_code == 200 and type_match and len_match)

            if not url_ok:
                public_tests_ok = False

            print(f"  • [{folder:<15}] Status: {status_code} | Content-Type: {resp_content_type} ({'MATCH' if type_match else 'DIFF'}) | Size: {resp_content_len} B ({'MATCH' if len_match else 'DIFF'})")
            print(f"      URL: {public_url}")
        except Exception as ex:
            public_tests_ok = False
            print(f"  • [{folder:<15}] Public access failed: {ex}")

    # 7. Final Stage 2 Summary
    print("\n" + "=" * 80)
    print("STAGE 2 SUMMARY")
    print("=" * 80)

    stage2_passed = (
        upload_stats['success'] == 541 and
        upload_stats['failed'] == 0 and
        len(missing_in_dest) == 0 and
        len(size_mismatches) == 0 and
        public_tests_ok
    )

    print(f"  • Total files uploaded:           {upload_stats['success']} / 541")
    print(f"  • Total bytes uploaded:           {upload_stats['bytes_uploaded']:,} bytes")
    print(f"  • Upload failures:                {upload_stats['failed']}")
    print(f"  • Network retries required:       {upload_stats['retries']}")
    print(f"  • Path & size verification:       {'PASS' if len(missing_in_dest) == 0 and len(size_mismatches) == 0 else 'FAIL'}")
    print(f"  • Public HTTP CDN access:         {'PASS' if public_tests_ok else 'FAIL'}")
    print(f"  • Overall Stage 2 Result:         {'PASS' if stage2_passed else 'NEEDS ATTENTION'}")

if __name__ == '__main__':
    run_stage2()

