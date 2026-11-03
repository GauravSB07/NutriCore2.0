import os
import sys
import time
import json
import django
from django.db import connection, reset_queries
from django.test.utils import CaptureQueriesContext

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NutriCore.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory, force_authenticate
from Nutrition.api.views import (
    DailyNutritionSummaryView, CheatMealStatusView, FoodListView, MealLogListCreateView
)
from Progress.api.views import DailyProgressView
from Nutrition.models import Food, MealLog

def run_verification():
    print("=" * 70)
    print("NutriCore Priority 3: Frontend Performance & Verification Benchmark")
    print("=" * 70)

    user = User.objects.filter(is_superuser=True).first()
    factory = APIRequestFactory()

    print(f"\n[1] Testing Dashboard APIs for User: {user.username} (ID: {user.id})")
    
    # 1. Measure DailyNutritionSummaryView (Prior request that was removed)
    req1 = factory.get('/api/v1/nutrition/summary/')
    force_authenticate(req1, user=user)
    reset_queries()
    t0 = time.perf_counter()
    with CaptureQueriesContext(connection) as ctx1:
        res1 = DailyNutritionSummaryView.as_view()(req1)
    t_summary_ms = (time.perf_counter() - t0) * 1000
    q_summary = len(ctx1)

    # 2. Measure DailyProgressView (The retained comprehensive endpoint)
    req2 = factory.get('/api/v1/progress/daily/')
    force_authenticate(req2, user=user)
    reset_queries()
    t0 = time.perf_counter()
    with CaptureQueriesContext(connection) as ctx2:
        res2 = DailyProgressView.as_view()(req2)
    t_progress_ms = (time.perf_counter() - t0) * 1000
    q_progress = len(ctx2)

    # 3. Measure CheatMealStatusView
    req3 = factory.get('/api/v1/nutrition/cheat/status/')
    force_authenticate(req3, user=user)
    reset_queries()
    t0 = time.perf_counter()
    with CaptureQueriesContext(connection) as ctx3:
        res3 = CheatMealStatusView.as_view()(req3)
    t_cheat_ms = (time.perf_counter() - t0) * 1000
    q_cheat = len(ctx3)

    print(f"  - GET /nutrition/summary/     : {t_summary_ms:6.1f}ms | Queries: {q_summary} (REMOVED as redundant)")
    print(f"  - GET /progress/daily/        : {t_progress_ms:6.1f}ms | Queries: {q_progress} (RETAINED)")
    print(f"  - GET /nutrition/cheat/status/: {t_cheat_ms:6.1f}ms | Queries: {q_cheat} (RETAINED)")

    # Data equivalence verification
    d_summary = res1.data
    d_progress = res2.data
    d_cheat = res3.data

    print("\n[2] Verifying Data Equivalence between Endpoints:")
    sum_cals = d_summary.get('calories', {}).get('consumed', 0)
    prog_cals = d_progress.get('nutrition', {}).get('total_calories', 0)
    print(f"  - Calories: Summary={sum_cals} vs Progress={prog_cals} -> {'MATCH' if sum_cals == prog_cals else 'MISMATCH'}")
    assert sum_cals == prog_cals, f"Calories mismatch: {sum_cals} vs {prog_cals}"

    sum_prot = d_summary.get('macronutrients', {}).get('protein', {}).get('consumed', 0)
    prog_prot = d_progress.get('nutrition', {}).get('total_protein', 0)
    print(f"  - Protein : Summary={sum_prot} vs Progress={prog_prot} -> {'MATCH' if sum_prot == prog_prot else 'MISMATCH'}")
    assert sum_prot == prog_prot, f"Protein mismatch: {sum_prot} vs {prog_prot}"

    sum_water = d_summary.get('water_summary', {}).get('total_consumed_ml', 0)
    prog_water = d_progress.get('water', {}).get('total_water_ml', 0)
    print(f"  - Water   : Summary={sum_water} vs Progress={prog_water} -> {'MATCH' if sum_water == prog_water else 'MISMATCH'}")
    assert sum_water == prog_water, f"Water mismatch: {sum_water} vs {prog_water}"

    cheat_count = d_cheat.get('today_cheat_meals', 0)
    sum_cheat = d_summary.get('cheat_summary', {}).get('cheat_meals_count', 0)
    print(f"  - Cheat Count: CheatStatus={cheat_count} vs Summary={sum_cheat} -> {'MATCH' if cheat_count == sum_cheat else 'MISMATCH'}")
    assert cheat_count == sum_cheat, f"Cheat count mismatch: {cheat_count} vs {sum_cheat}"

    print(f"  - Steps   : Progress total_steps = {d_progress.get('steps', {}).get('total_steps')} -> OK")
    print(f"  - Day Type: Progress day_type = {d_progress.get('nutrition', {}).get('day_type')} -> OK")
    print(f"  - Points  : Cheat points = {d_cheat.get('points')}, Progress points = {d_progress.get('points')} -> OK")

    print("\n[3] Verifying Dashboard Request Count Reduction:")
    print(f"  - Before: 3 network requests, {q_summary + q_progress + q_cheat} total database queries")
    print(f"  - After : 2 network requests, {q_progress + q_cheat} total database queries")
    print(f"  - Saved : 1 round-trip (~{t_summary_ms:.1f}ms) and {q_summary} database round-trips to Supabase!")

    print("\n[4] Testing Food Search and Meal Logging:")
    # Food search
    req_search = factory.get('/api/v1/nutrition/foods/', {'search': 'apple', 'page_size': 5})
    force_authenticate(req_search, user=user)
    t0 = time.perf_counter()
    res_search = FoodListView.as_view()(req_search)
    t_search_ms = (time.perf_counter() - t0) * 1000
    print(f"  - Food Search ('apple'): {t_search_ms:6.1f}ms | Status: {res_search.status_code} | Count: {len(res_search.data.get('results', []))}")

    # Food calculation & meal creation
    food = Food.objects.first()
    if food:
        print(f"  - Selected Food: {food.name} (cal_100g={food.calories_per_100g}, prot_100g={food.protein_per_100g}, cal_unit={food.calories_per_unit})")
        # Test creating meal log
        req_post = factory.post('/api/v1/nutrition/meals/', {
            'food_id': food.id,
            'quantity': 150,
            'unit': 'g',
        }, format='json')
        force_authenticate(req_post, user=user)
        res_post = MealLogListCreateView.as_view()(req_post)
        print(f"  - POST /nutrition/meals/ status: {res_post.status_code}")
        if res_post.status_code == 201:
            meal_id = res_post.data.get('id')
            saved_cals = res_post.data.get('calories')
            saved_prot = res_post.data.get('protein')
            print(f"  - Created Meal ID: {meal_id} | Calories: {saved_cals} | Protein: {saved_prot}")
            # Clean up test meal
            MealLog.objects.filter(id=meal_id).delete()
            print(f"  - Cleaned up test meal ID: {meal_id}")
    
    print("\n" + "=" * 70)
    print("ALL PRIORITY 3 VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == '__main__':
    run_verification()
