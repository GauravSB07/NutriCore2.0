import os
import sys
import time
import django
from django.db import connection, reset_queries
from django.test.utils import CaptureQueriesContext

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NutriCore.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory, force_authenticate
from Nutrition.api.views import (
    FoodListView, CategoryListView, MealLogListCreateView
)
from Workouts.api.views import (
    MuscleGroupListView, SubMuscleListView, ExerciseListView, WorkoutSessionListCreateView
)
from Recipes.api.views import (
    RecipeListCreateView, RecipeCategoryListCreateView
)
from Progress.api.views import (
    DailyProgressView, WeeklyProgressView, MonthlyProgressView, ProgressSummaryView
)

def benchmark_endpoint(name, view_func, path, user=None, params=None):
    factory = APIRequestFactory()
    request = factory.get(path, params or {}, HTTP_HOST='127.0.0.1')
    if user:
        force_authenticate(request, user=user)
    
    # Warm up / connection check
    reset_queries()
    
    # Measure
    start_time = time.perf_counter()
    with CaptureQueriesContext(connection) as queries_ctx:
        response = view_func(request)
    duration_ms = (time.perf_counter() - start_time) * 1000
    
    query_count = len(queries_ctx)
    db_time_ms = sum(float(q.get('time', 0)) for q in queries_ctx) * 1000
    status_code = response.status_code
    
    # Count payload size roughly
    import json
    try:
        data = response.data
        payload_size_kb = len(json.dumps(data, default=str).encode('utf-8')) / 1024
    except Exception:
        payload_size_kb = 0
        
    print(f"{name:<35} | Status: {status_code} | Total: {duration_ms:6.1f}ms | DB: {db_time_ms:6.1f}ms | Queries: {query_count:3d} | Payload: {payload_size_kb:5.1f}KB")
    
    # Print query details if high query count (N+1 detector)
    if query_count > 5:
        print(f"   [!] Potential N+1 or high query count ({query_count} queries):")
        query_samples = [q['sql'][:100] for q in queries_ctx[:4]]
        for qs in query_samples:
            print(f"       -> {qs}...")
    
    return {
        'name': name,
        'status': status_code,
        'total_ms': duration_ms,
        'db_ms': db_time_ms,
        'queries': query_count,
        'size_kb': payload_size_kb,
    }

def measure_raw_supabase_ping():
    print("=== Raw Supabase Latency Test ===")
    times = []
    for _ in range(5):
        t0 = time.perf_counter()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            cursor.fetchone()
        t1 = time.perf_counter()
        times.append((t1 - t0) * 1000)
    avg_ping = sum(times) / len(times)
    min_ping = min(times)
    max_ping = max(times)
    print(f"Ping (SELECT 1): Avg = {avg_ping:.1f}ms (Min: {min_ping:.1f}ms, Max: {max_ping:.1f}ms)")
    print(f"Individual: {[round(t, 1) for t in times]}")
    return avg_ping

def run_benchmarks():
    print("=== Supabase Connection & Latency ===")
    measure_raw_supabase_ping()
    
    admin_user = User.objects.filter(is_superuser=True).first()
    normal_user = User.objects.filter(is_superuser=False).first() or admin_user
    print(f"\nBenchmarking as user: {normal_user.username} (ID: {normal_user.id})")
    
    print("\n=== API Endpoints Benchmark ===")
    print(f"{'Endpoint':<35} | {'Status'} | {'Total Time':<11} | {'DB Time':<9} | {'Queries':<9} | {'Size'}")
    print("-" * 85)
    
    benchmarks = [
        # Nutrition
        ("Food List (page 1, 20)", FoodListView.as_view(), "/api/v1/nutrition/foods/"),
        ("Food List (search 'rice')", FoodListView.as_view(), "/api/v1/nutrition/foods/?search=rice", None, {'search': 'rice'}),
        ("Categories List", CategoryListView.as_view(), "/api/v1/nutrition/categories/"),
        ("Meal Logs Today", MealLogListCreateView.as_view(), "/api/v1/nutrition/meals/", normal_user, {'date': '2026-11-02'}),
        
        # Workouts
        ("Muscle Groups", MuscleGroupListView.as_view(), "/api/v1/workouts/muscles/"),
        ("Sub Muscles", SubMuscleListView.as_view(), "/api/v1/workouts/sub-muscles/"),
        ("Exercises List (page 1)", ExerciseListView.as_view(), "/api/v1/workouts/exercises/"),
        ("Workout Sessions List", WorkoutSessionListCreateView.as_view(), "/api/v1/workouts/sessions/", normal_user),
        
        # Recipes
        ("Recipe List (page 1)", RecipeListCreateView.as_view(), "/api/v1/recipes/"),
        ("Recipe Categories", RecipeCategoryListCreateView.as_view(), "/api/v1/recipes/categories/"),
        
        # Progress
        ("Progress Summary", ProgressSummaryView.as_view(), "/api/v1/progress/summary/", normal_user),
        ("Daily Progress", DailyProgressView.as_view(), "/api/v1/progress/daily/", normal_user, {'date': '2026-11-02'}),
        ("Weekly Progress", WeeklyProgressView.as_view(), "/api/v1/progress/weekly/", normal_user),
        ("Monthly Progress", MonthlyProgressView.as_view(), "/api/v1/progress/monthly/", normal_user),
    ]
    
    results = []
    for item in benchmarks:
        user = item[3] if len(item) > 3 else None
        params = item[4] if len(item) > 4 else None
        res = benchmark_endpoint(item[0], item[1], item[2], user, params)
        results.append(res)
        
    print("\n=== Summary of Top Slowest Endpoints ===")
    sorted_results = sorted(results, key=lambda x: x['total_ms'], reverse=True)
    for r in sorted_results[:5]:
        print(f"- {r['name']}: {r['total_ms']:.1f}ms ({r['queries']} queries, {r['db_ms']:.1f}ms DB time)")

if __name__ == '__main__':
    run_benchmarks()
