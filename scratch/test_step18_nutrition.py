import os
import sys
import django
import uuid
from decimal import Decimal

# Configure Django environment
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NutriCore.settings')
django.setup()

from django.conf import settings
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

from django.contrib.auth.models import User
from django.utils.timezone import localdate
from rest_framework.test import APIClient
from Nutrition.models import Food, Category, MealLog, WaterIntake
from Users.models import Profile

def run_tests():
    print("=" * 70)
    print("STEP 18: COMPLETE NUTRITION MODULE VERIFICATION SUITE")
    print("=" * 70)

    client = APIClient()
    uid = uuid.uuid4().hex[:8]

    # 1. Create isolated test user
    username = f"nutri_user_{uid}"
    email = f"{username}@example.com"
    password = "SecurePassword123!"

    user = User.objects.create_user(username=username, email=email, password=password)
    profile, _ = Profile.objects.get_or_create(user=user, defaults={'points': 100, 'daily_calorie_target': 2200, 'daily_protein_target': 120})
    profile.points = 100
    profile.save()

    # Create second isolated user for data isolation testing
    other_user = User.objects.create_user(username=f"other_{uid}", email=f"other_{uid}@example.com", password=password)
    other_client = APIClient()

    # Login test user
    login_res = client.post('/api/v1/auth/login/', {'username': username, 'password': password})
    assert login_res.status_code == 200, f"Login failed: {login_res.data}"
    tokens = login_res.data['tokens']
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    other_login = other_client.post('/api/v1/auth/login/', {'username': f"other_{uid}", 'password': password})
    assert other_login.status_code == 200
    other_tokens = other_login.data['tokens']
    other_client.credentials(HTTP_AUTHORIZATION=f"Bearer {other_tokens['access']}")

    print("✔ Isolated test accounts created and authenticated via JWT")

    # 2. Test Food Categories API
    cat_res = client.get('/api/v1/nutrition/categories/')
    assert cat_res.status_code == 200, f"Categories failed: {cat_res.data}"
    categories = cat_res.data if isinstance(cat_res.data, list) else cat_res.data.get('results', [])
    print(f"✔ GET /api/v1/nutrition/categories/ returned {len(categories)} categories")

    # 3. Test Food Catalog & Pagination API
    foods_res = client.get('/api/v1/nutrition/foods/')
    assert foods_res.status_code == 200, f"Foods catalog failed: {foods_res.data}"
    assert 'count' in foods_res.data, "Expected DRF pagination count field"
    assert 'results' in foods_res.data, "Expected DRF pagination results field"
    food_count = foods_res.data['count']
    food_items = foods_res.data['results']
    print(f"✔ GET /api/v1/nutrition/foods/ returned paginated catalogue (count: {food_count}, page items: {len(food_items)})")

    # 4. Test Search and Filter
    sample_food = Food.objects.first()
    if not sample_food:
        # Create test food
        sample_food = Food.objects.create(
            name=f"Test Protein Bar {uid}",
            calories_per_100g=350,
            protein_per_100g=30,
            calories_per_unit=175,
            protein_per_unit=15,
            unit_type='g',
            serving_name='bar',
            serving_quantity=50
        )

    search_res = client.get(f'/api/v1/nutrition/foods/?search={sample_food.name[:4]}')
    assert search_res.status_code == 200
    search_results = search_res.data.get('results', [])
    assert any(f['id'] == sample_food.id for f in search_results), "Search did not find sample food"
    print(f"✔ Food search filter verified successfully (?search={sample_food.name[:4]})")

    # 5. Test Food Details API
    detail_res = client.get(f'/api/v1/nutrition/foods/{sample_food.id}/')
    assert detail_res.status_code == 200, f"Food detail failed: {detail_res.data}"
    food_detail = detail_res.data
    assert food_detail['id'] == sample_food.id
    assert food_detail['name'] == sample_food.name
    print(f"✔ GET /api/v1/nutrition/foods/{sample_food.id}/ returned food details")

    # 6. Test Meal Creation (Base Unit)
    # 200g of sample_food: cal = (cal100/100)*200 = 2 * cal100
    expected_cal_base = round(((sample_food.calories_per_100g or 0) / 100) * 200, 1) if sample_food.unit_type in ['g', 'ml'] else round((sample_food.calories_per_unit or 0) * 200, 1)
    meal_post_res = client.post('/api/v1/nutrition/meals/', {
        'food_id': sample_food.id,
        'quantity': 200,
        'unit': sample_food.unit_type,
    })
    assert meal_post_res.status_code == 201, f"Meal log creation failed: {meal_post_res.data}"
    meal_1 = meal_post_res.data
    assert abs(meal_1['calories'] - expected_cal_base) <= 0.5, f"Expected cal ~{expected_cal_base}, got {meal_1['calories']}"
    print(f"✔ POST /api/v1/nutrition/meals/ created meal (id: {meal_1['id']}, calories: {meal_1['calories']}, protein: {meal_1['protein']})")

    # 7. Test Meal Creation with Serving Unit
    if sample_food.serving_quantity:
        serving_res = client.post('/api/v1/nutrition/meals/', {
            'food_id': sample_food.id,
            'quantity': 2,
            'unit': 'serving',
        })
        assert serving_res.status_code == 201, f"Serving meal failed: {serving_res.data}"
        meal_serving = serving_res.data
        # 2 servings = 2 * serving_quantity base units
        base_qty = 2 * sample_food.serving_quantity
        expected_cal_serv = round(((sample_food.calories_per_100g or 0) / 100) * base_qty, 1) if sample_food.unit_type in ['g', 'ml'] else round((sample_food.calories_per_unit or 0) * base_qty, 1)
        assert abs(meal_serving['calories'] - expected_cal_serv) <= 0.5
        print(f"✔ Serving conversion meal verified (2 servings -> {base_qty} {sample_food.unit_type}, calories: {meal_serving['calories']})")

    # 8. Test Meal Update (PATCH)
    patch_res = client.patch(f"/api/v1/nutrition/meals/{meal_1['id']}/", {
        'quantity': 100,
    })
    assert patch_res.status_code == 200, f"Meal update failed: {patch_res.data}"
    updated_meal = patch_res.data
    assert updated_meal['quantity'] == 100
    expected_updated_cal = round(((sample_food.calories_per_100g or 0) / 100) * 100, 1) if sample_food.unit_type in ['g', 'ml'] else round((sample_food.calories_per_unit or 0) * 100, 1)
    assert abs(updated_meal['calories'] - expected_updated_cal) <= 0.5
    print(f"✔ PATCH /api/v1/nutrition/meals/{meal_1['id']}/ recalculated calories correctly ({updated_meal['calories']} kcal)")

    # 9. Test User Data Isolation
    other_get = other_client.get(f"/api/v1/nutrition/meals/{meal_1['id']}/")
    assert other_get.status_code == 404, f"Data isolation breach: other user accessed meal log! status={other_get.status_code}"
    other_patch = other_client.patch(f"/api/v1/nutrition/meals/{meal_1['id']}/", {'quantity': 999})
    assert other_patch.status_code == 404, "Data isolation breach: other user modified meal log!"
    other_delete = other_client.delete(f"/api/v1/nutrition/meals/{meal_1['id']}/")
    assert other_delete.status_code == 404, "Data isolation breach: other user deleted meal log!"
    print("✔ User data isolation confirmed: other user receives 404 on all unauthorized access")

    # 10. Test Meal Deletion
    del_res = client.delete(f"/api/v1/nutrition/meals/{meal_1['id']}/")
    assert del_res.status_code == 200, f"Meal deletion failed: {del_res.data}"
    assert not MealLog.objects.filter(id=meal_1['id']).exists()
    print("✔ DELETE /api/v1/nutrition/meals/{id}/ deleted meal successfully")

    # 11. Test Water Tracking APIs
    water_init = client.get('/api/v1/nutrition/water/')
    assert water_init.status_code == 200
    init_ml = water_init.data['total_consumed_ml']

    # Quick Add 100ml, 200ml, 300ml, 500ml, 1000ml
    amounts = [100, 200, 300, 500, 1000]
    cumulative = init_ml
    for amt in amounts:
        w_post = client.post('/api/v1/nutrition/water/', {'amount': amt})
        assert w_post.status_code == 201, f"Water log {amt}ml failed: {w_post.data}"
        cumulative += amt
        assert abs(w_post.data['daily_total_ml'] - cumulative) <= 0.1

    water_after = client.get('/api/v1/nutrition/water/')
    assert water_after.status_code == 200
    assert abs(water_after.data['total_consumed_ml'] - cumulative) <= 0.1
    print(f"✔ Water tracking verified: logged quick-add values {amounts}, daily total: {cumulative}ml (percentage: {water_after.data['percentage']}%)")

    # 12. Test Cheat Meal Status & Calculations
    cheat_status_res = client.get('/api/v1/nutrition/cheat/status/')
    assert cheat_status_res.status_code == 200
    assert 'points' in cheat_status_res.data
    assert 'can_log_cheat' in cheat_status_res.data
    assert 'remaining_cheat_calories' in cheat_status_res.data
    assert 'remaining_cheat_meals' in cheat_status_res.data
    print(f"✔ GET /api/v1/nutrition/cheat/status/ returned points: {cheat_status_res.data['points']}, can_log_cheat: {cheat_status_res.data['can_log_cheat']}")

    # 13. Test Cheat Meal Insufficient Points Rejection
    profile.points = 5  # Too low (< 25 and < required points)
    profile.save()
    cheat_fail_res = client.post('/api/v1/nutrition/cheat/', {
        'food_id': sample_food.id,
        'quantity': 200,
        'unit': sample_food.unit_type,
    })
    assert cheat_fail_res.status_code == 400, f"Expected 400 rejection for low points, got {cheat_fail_res.status_code}: {cheat_fail_res.data}"
    print("✔ Cheat meal point limit enforcement verified (rejected when user points insufficient)")

    # 14. Test Successful Cheat Meal with authoritative point deduction
    profile.points = 100
    profile.save()
    cheat_success_res = client.post('/api/v1/nutrition/cheat/', {
        'food_id': sample_food.id,
        'quantity': 50,
        'unit': sample_food.unit_type,
    })
    assert cheat_success_res.status_code == 201, f"Cheat meal failed: {cheat_success_res.data}"
    deducted = cheat_success_res.data['points_deducted']
    remaining = cheat_success_res.data['remaining_points']
    assert remaining == 100 - deducted
    profile.refresh_from_db()
    assert profile.points == remaining
    print(f"✔ Cheat meal successfully logged: deducted {deducted} pts, remaining {remaining} pts")

    # 15. Test Daily Nutrition Summary
    summary_res = client.get('/api/v1/nutrition/summary/')
    assert summary_res.status_code == 200
    sum_data = summary_res.data
    assert 'calories' in sum_data
    assert 'macronutrients' in sum_data
    assert 'cheat_summary' in sum_data
    assert 'water_summary' in sum_data
    print(f"✔ GET /api/v1/nutrition/summary/ returned complete breakdown (consumed cal: {sum_data['calories']['consumed']}, water: {sum_data['water_summary']['total_consumed_ml']}ml)")

    print("=" * 70)
    print("ALL 15 NUTRITION INTEGRATION CHECKS PASSED PERFECTLY!")
    print("=" * 70)

if __name__ == '__main__':
    run_tests()
