import time
import json
import requests

DJANGO_BASE = "http://127.0.0.1:8000"
VITE_BASE = "http://localhost:5173"

MUMBAI_REF = "yrzoevojuwmevkfapzti"
IRELAND_REF = "sqmvywntkdnrcnfplxer"

def run_local_cutover_tests():
    print("=" * 80)
    print("STAGE 3B: LOCAL CUTOVER VERIFICATION TEST SUITE")
    print("=" * 80)

    results = []

    def log_test(category, name, passed, details="", duration_ms=0):
        status_str = "PASS" if passed else "FAIL"
        print(f"[{status_str:^6}] {category:<15} | {name:<35} | {duration_ms:6.1f} ms | {details}")
        results.append({
            'category': category,
            'name': name,
            'passed': passed,
            'details': details,
            'duration_ms': duration_ms
        })

    # 1. Frontend Test
    print("\n--- 1. Frontend Web App Availability ---")
    try:
        t0 = time.perf_counter()
        resp = requests.get(VITE_BASE, timeout=5)
        d_ms = (time.perf_counter() - t0) * 1000
        has_root = '<div id="root">' in resp.text
        log_test("Frontend", "Vite Dev Server (Root HTML)", resp.status_code == 200 and has_root, f"HTTP {resp.status_code}, contains #root", d_ms)
    except Exception as e:
        log_test("Frontend", "Vite Dev Server (Root HTML)", False, f"Connection failed: {e}")

    # 2. Authentication Endpoint Availability
    print("\n--- 2. Authentication Endpoints Availability (GET / OPTIONS) ---")
    auth_endpoints = [
        ("Login availability", "/api/v1/auth/login/", 405), # POST only, GET returns 405 Method Not Allowed
        ("Register availability", "/api/v1/auth/register/", 405), # POST only
        ("Token Refresh availability", "/api/v1/auth/token/refresh/", 405), # POST only
        ("Current User Profile (unauth)", "/api/v1/auth/me/", 401), # Requires auth, returns 401
    ]
    for name, ep, exp_status in auth_endpoints:
        try:
            t0 = time.perf_counter()
            resp = requests.get(f"{DJANGO_BASE}{ep}", timeout=10)
            d_ms = (time.perf_counter() - t0) * 1000
            passed = (resp.status_code == exp_status)
            log_test("Auth", name, passed, f"HTTP {resp.status_code} (Expected: {exp_status})", d_ms)
        except Exception as e:
            log_test("Auth", name, False, f"Failed: {e}")

    # 3. Catalogue APIs & Dynamic URL Verification
    print("\n--- 3. Catalogue APIs & Dynamic Mumbai Image URL Verification ---")
    catalogue_endpoints = [
        ("Food Categories List", "/api/v1/nutrition/categories/", 18),
        ("Food Catalogue List (Page 1)", "/api/v1/nutrition/foods/?page=1", 20),
        ("Muscle Groups List", "/api/v1/workouts/muscles/", 8),
        ("Sub-Muscles List", "/api/v1/workouts/submuscles/", 27),
        ("Exercise Catalogue List", "/api/v1/workouts/exercises/?page=1", 20),
        ("Recipe Categories List", "/api/v1/recipes/categories/", 11),
        ("Recipe Catalogue List", "/api/v1/recipes/?page=1", 20),
    ]

    image_urls_to_test = {}

    for name, ep, min_expected_count in catalogue_endpoints:
        try:
            t0 = time.perf_counter()
            resp = requests.get(f"{DJANGO_BASE}{ep}", timeout=15)
            d_ms = (time.perf_counter() - t0) * 1000

            if resp.status_code != 200:
                log_test("Catalogue", name, False, f"HTTP {resp.status_code}: {resp.text[:80]}", d_ms)
                continue

            data = resp.json()
            items = data.get('results') if isinstance(data, dict) and 'results' in data else data
            count = len(items) if isinstance(items, list) else 0

            # Inspect image URLs in response
            has_mumbai_urls = False
            has_ireland_urls = False
            for item in (items if isinstance(items, list) else []):
                img_url = item.get('image_url') or item.get('image')
                if img_url and isinstance(img_url, str):
                    if MUMBAI_REF in img_url:
                        has_mumbai_urls = True
                    if IRELAND_REF in img_url:
                        has_ireland_urls = True

                    # Collect samples
                    if 'category' not in name.lower() and name not in image_urls_to_test and img_url.startswith('http'):
                        image_urls_to_test[name] = img_url

            passed = (resp.status_code == 200 and count >= min_expected_count and not has_ireland_urls and (has_mumbai_urls or 'categories' in ep))
            details = f"Count: {count} | Mumbai URLs: {has_mumbai_urls} | Ireland URLs: {has_ireland_urls}"
            log_test("Catalogue", name, passed, details, d_ms)
        except Exception as e:
            log_test("Catalogue", name, False, f"Failed: {e}")

    # 4. Public Image URL Fetch Verification
    print("\n--- 4. Public Image URLs Fetch Verification (Mumbai CDN) ---")
    for category_name, img_url in image_urls_to_test.items():
        try:
            t0 = time.perf_counter()
            head_resp = requests.head(img_url, timeout=10)
            d_ms = (time.perf_counter() - t0) * 1000
            status_code = head_resp.status_code
            ctype = head_resp.headers.get('Content-Type')
            clen = head_resp.headers.get('Content-Length')

            passed = (status_code == 200 and MUMBAI_REF in img_url and IRELAND_REF not in img_url)
            details = f"HTTP {status_code} | {ctype} | {clen} B | Host: {MUMBAI_REF}"
            log_test("Image CDN", f"Image: {category_name}", passed, details, d_ms)
        except Exception as e:
            log_test("Image CDN", f"Image: {category_name}", False, f"Failed: {e}")

    # 5. Dashboard Endpoint Check (Unauthenticated)
    print("\n--- 5. Dashboard & Protected Route Security ---")
    dashboard_endpoints = [
        ("Nutrition Summary (unauth)", "/api/v1/nutrition/summary/"),
        ("Daily Progress (unauth)", "/api/v1/progress/daily/"),
        ("Lifetime Summary (unauth)", "/api/v1/progress/summary/"),
    ]
    for name, ep in dashboard_endpoints:
        try:
            t0 = time.perf_counter()
            resp = requests.get(f"{DJANGO_BASE}{ep}", timeout=10)
            d_ms = (time.perf_counter() - t0) * 1000
            passed = (resp.status_code == 401)
            log_test("Protected", name, passed, f"HTTP {resp.status_code} (Properly guarded)", d_ms)
        except Exception as e:
            log_test("Protected", name, False, f"Failed: {e}")

    # 6. Overall Isolation & Readiness Summary
    print("\n" + "=" * 80)
    print("STAGE 3B SUMMARY")
    print("=" * 80)
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r['passed'])
    failed_tests = total_tests - passed_tests

    print(f"Total Tests Executed: {total_tests}")
    print(f"Passed:               {passed_tests}")
    print(f"Failed:               {failed_tests}")

    all_passed = (failed_tests == 0)
    print(f"Overall Stage 3B Result: {'PASS' if all_passed else 'FAIL'}")

if __name__ == '__main__':
    run_local_cutover_tests()

