import time
import json
import urllib.request
import urllib.parse
import urllib.error

BASE_URL = "http://127.0.0.1:8000/api/v1"

def http_post(endpoint, data):
    url = f"{BASE_URL}{endpoint}"
    payload = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req) as resp:
        t1 = time.perf_counter()
        body = json.loads(resp.read().decode('utf-8'))
        return (t1 - t0) * 1000, resp.getcode(), body

def http_get(endpoint, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    if token:
        headers['Authorization'] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req) as resp:
            t1 = time.perf_counter()
            data = resp.read()
            size_kb = len(data) / 1024
            body = json.loads(data.decode('utf-8'))
            return (t1 - t0) * 1000, resp.getcode(), size_kb, body
    except urllib.error.HTTPError as e:
        t1 = time.perf_counter()
        return (t1 - t0) * 1000, e.code, 0, None

def run():
    print("=== Measuring Authentication Latency ===")
    t_login, code, body = http_post("/auth/login/", {"username": "nutricore_admin", "password": "N8@vR4#qT9!mK6$wX2pL"})
    access_token = body.get("tokens", {}).get("access")
    print(f"Login (/auth/login/): {t_login:.1f}ms (Status: {code}) | Token Acquired: {bool(access_token)}")
    
    endpoints = [
        # Dashboard
        ("Dashboard Nutrition Summary", "/nutrition/summary/?date=2026-11-02", True),
        ("Dashboard Daily Progress", "/progress/daily/?date=2026-11-02", True),
        ("Dashboard Cheat Status", "/nutrition/cheat/status/?date=2026-11-02", True),
        ("Dashboard Lifetime Summary", "/progress/summary/", True),

        # Nutrition
        ("Food List (page 1)", "/nutrition/foods/?page=1", False),
        ("Food Search ('apple')", "/nutrition/foods/?search=apple", False),
        ("Food Search ('chicken')", "/nutrition/foods/?search=chicken", False),
        ("Food Categories List", "/nutrition/categories/", False),
        ("Meal Logs Today", "/nutrition/meals/?date=2026-11-02", True),
        ("Water Intake Today", "/nutrition/water/?date=2026-11-02", True),

        # Workouts
        ("Muscle Groups List", "/workouts/muscles/", False),
        ("Sub Muscles List", "/workouts/submuscles/", False),
        ("Exercises List (page 1)", "/workouts/exercises/?page=1", False),
        ("Exercises for SubMuscle (Chest)", "/workouts/exercises/?sub_muscle=56", False),
        ("Workout Sessions List", "/workouts/sessions/", True),

        # Progress
        ("Daily Report", "/progress/daily/", True),
        ("Weekly Report", "/progress/weekly/", True),
        ("Monthly Report", "/progress/monthly/", True),
        ("Weight Status", "/progress/weight/", True),

        # Recipes
        ("Recipe List (page 1)", "/recipes/?page=1", False),
        ("Recipe Categories", "/recipes/categories/", False),
    ]

    print("\n=== Real HTTP API Endpoint Benchmark (via Django Dev Server) ===")
    print(f"{'Endpoint Description':<35} | {'Status'} | {'HTTP Latency':<12} | {'Payload'}")
    print("-" * 70)
    
    results = []
    for name, path, auth_req in endpoints:
        token = access_token if auth_req else None
        latency_ms, status_code, size_kb, _ = http_get(path, token)
        print(f"{name:<35} | {status_code:<6} | {latency_ms:7.1f}ms   | {size_kb:5.1f}KB")
        results.append({
            'name': name,
            'path': path,
            'status': status_code,
            'latency_ms': latency_ms,
            'size_kb': size_kb,
        })
        
    print("\n=== Top 5 Slowest Endpoints via HTTP ===")
    sorted_results = sorted(results, key=lambda x: x['latency_ms'], reverse=True)
    for r in sorted_results[:5]:
        print(f"- {r['name']} ({r['path']}): {r['latency_ms']:.1f}ms")

if __name__ == '__main__':
    run()
