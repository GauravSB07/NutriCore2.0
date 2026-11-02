import os
import sys

# Configure UTF-8 stdout
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NutriCore.settings')

import django
django.setup()

from django.conf import settings
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date
from Nutrition.models import Food, Category, MealLog, WaterIntake
from Workouts.models import MuscleGroup, SubMuscle, Exercise, WorkoutSession, WorkoutSet
from Recipes.models import Recipe, RecipeCategory
from Progress.models import StepsLog

User = get_user_model()

def run_e2e_tests():
    print("=== Phase 4 — Step 23: Complete E2E Integration Audit ===")
    client = APIClient()

    # -------------------------------------------------------------------------
    # 1. Authentication Lifecycle
    # -------------------------------------------------------------------------
    print("\n[Workflow 1] Testing Full Authentication Lifecycle...")
    test_username = 'e2e_audit_user'
    test_password = 'AuditPassword123!'
    test_email = 'e2e_audit@example.com'

    # Cleanup prior run if exists
    User.objects.filter(username=test_username).delete()

    # Register
    reg_res = client.post('/api/v1/auth/register/', {
        'username': test_username,
        'email': test_email,
        'password': test_password,
        'password_confirm': test_password,
        'goal': 'fat_loss',
        'height': 175.0,
        'weight': 80.0,
        'daily_calorie_target': 2200,
        'daily_protein_target': 160,
    })
    assert reg_res.status_code == status.HTTP_201_CREATED, f"Registration failed: {reg_res.data}"
    assert 'tokens' in reg_res.data
    access_token = reg_res.data['tokens']['access']
    refresh_token = reg_res.data['tokens']['refresh']
    assert 'refresh_token' in reg_res.cookies, "HttpOnly refresh cookie must be set on registration"
    print("  ✓ User registered with auto-provisioned profile & HttpOnly refresh cookie.")

    # Authenticated Me profile
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
    me_res = client.get('/api/v1/auth/me/')
    assert me_res.status_code == status.HTTP_200_OK
    assert me_res.data['username'] == test_username
    assert me_res.data['profile']['goal'] == 'fat_loss'
    print("  ✓ Profile retrieved via /api/v1/auth/me/.")

    # Profile Update
    patch_res = client.patch(
        '/api/v1/auth/me/',
        {'profile': {'daily_water_goal': 3000, 'weight': 79.5}},
        format='json',
    )
    assert patch_res.status_code == status.HTTP_200_OK
    assert patch_res.data['profile']['daily_water_goal'] == 3000
    print("  ✓ Profile targets updated successfully.")

    # Token Refresh using Cookie
    client.credentials()  # strip authorization header
    # Pass cookie in client
    client.cookies['refresh_token'] = refresh_token
    refresh_res = client.post('/api/v1/auth/token/refresh/', {})
    assert refresh_res.status_code == status.HTTP_200_OK, f"Cookie refresh failed: {refresh_res.data}"
    new_access = refresh_res.data['access']
    print("  ✓ Silent token refresh succeeded via HttpOnly cookie.")

    # Logout
    logout_res = client.post('/api/v1/auth/logout/', {})
    assert logout_res.status_code == status.HTTP_200_OK
    # Verify blacklisted token cannot be reused
    client.cookies['refresh_token'] = refresh_token
    re_refresh = client.post('/api/v1/auth/token/refresh/', {})
    assert re_refresh.status_code == status.HTTP_401_UNAUTHORIZED
    print("  ✓ Logout invalidated refresh token and cleared session.")

    # Re-login for remaining user workflows
    login_res = client.post('/api/v1/auth/login/', {'username': test_username, 'password': test_password})
    assert login_res.status_code == status.HTTP_200_OK
    access_token = login_res.data['tokens']['access']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')

    # -------------------------------------------------------------------------
    # 2. Nutrition Workflow
    # -------------------------------------------------------------------------
    print("\n[Workflow 2] Testing Nutrition Workflow (Foods, Meals, Water, Cheat Meals)...")
    # Search foods
    foods_res = client.get('/api/v1/nutrition/foods/?search=rice')
    assert foods_res.status_code == status.HTTP_200_OK
    foods_list = foods_res.data if isinstance(foods_res.data, list) else foods_res.data.get('results', [])
    assert len(foods_list) > 0, "Expected to find food in catalogue"
    test_food = foods_list[0]

    # Food Detail
    food_detail = client.get(f'/api/v1/nutrition/foods/{test_food["id"]}/')
    assert food_detail.status_code == status.HTTP_200_OK
    assert food_detail.data['id'] == test_food['id']

    # Log Meal
    meal_log = client.post('/api/v1/nutrition/meals/', {
        'food_id': test_food['id'],
        'quantity': 150.0,
        'unit': 'g',
        'is_cheat': False,
    })
    assert meal_log.status_code == status.HTTP_201_CREATED, f"Meal log failed: {meal_log.data}"
    logged_meal_id = meal_log.data['id']
    print(f"  ✓ Logged meal {logged_meal_id} ({test_food['name']}, 150g).")

    # Update Meal
    update_meal = client.patch(f'/api/v1/nutrition/meals/{logged_meal_id}/', {
        'quantity': 200.0,
    })
    assert update_meal.status_code == status.HTTP_200_OK
    assert update_meal.data['quantity'] == 200.0

    # Add Water
    water_res = client.post('/api/v1/nutrition/water/', {'amount': 500})
    assert water_res.status_code == status.HTTP_201_CREATED
    print("  ✓ Water logged (+500ml).")

    # Nutrition Summary
    summary_res = client.get('/api/v1/nutrition/summary/')
    assert summary_res.status_code == status.HTTP_200_OK
    assert summary_res.data['water_summary']['total_consumed_ml'] >= 500
    assert summary_res.data['calories']['consumed'] > 0
    print("  ✓ Daily nutrition summary aggregates calories and water correctly.")

    # Delete Meal
    del_meal = client.delete(f'/api/v1/nutrition/meals/{logged_meal_id}/')
    assert del_meal.status_code in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]
    print("  ✓ Meal log deleted successfully.")

    # -------------------------------------------------------------------------
    # 3. Workouts Workflow
    # -------------------------------------------------------------------------
    print("\n[Workflow 3] Testing Workouts Workflow (Muscles, Exercises, Sessions, Sets)...")
    muscles_res = client.get('/api/v1/workouts/muscles/')
    assert muscles_res.status_code == status.HTTP_200_OK
    muscles = muscles_res.data if isinstance(muscles_res.data, list) else muscles_res.data.get('results', [])
    assert len(muscles) > 0, "Muscle groups must exist"

    ex_res = client.get('/api/v1/workouts/exercises/')
    assert ex_res.status_code == status.HTTP_200_OK
    exercises = ex_res.data if isinstance(ex_res.data, list) else ex_res.data.get('results', [])
    assert len(exercises) > 0, "Exercises must exist"
    first_ex = exercises[0]

    # Start workout session
    sub_muscle_id = first_ex['sub_muscle']['id'] if isinstance(first_ex.get('sub_muscle'), dict) else first_ex.get('sub_muscle')
    session_res = client.post('/api/v1/workouts/sessions/', {'sub_muscle_id': sub_muscle_id})
    assert session_res.status_code == status.HTTP_201_CREATED, f"Session create failed: {session_res.data}"
    session_id = session_res.data['id']

    # Log set
    set_res = client.post(f'/api/v1/workouts/sessions/{session_id}/sets/', {
        'exercise_id': first_ex['id'],
        'reps': 10,
        'weight': 60.0,
    })
    assert set_res.status_code == status.HTTP_201_CREATED, f"Set log failed: {set_res.data}"
    set_id = set_res.data['id']
    print(f"  ✓ Workout session #{session_id} created, logged set (10 reps x 60kg).")

    # Volume check in history
    hist_res = client.get('/api/v1/workouts/history/')
    assert hist_res.status_code == status.HTTP_200_OK
    hist_list = hist_res.data if isinstance(hist_res.data, list) else hist_res.data.get('results', [])
    assert len(hist_list) > 0

    # Cleanup workout test records
    client.delete(f'/api/v1/workouts/sets/{set_id}/')
    client.delete(f'/api/v1/workouts/sessions/{session_id}/')
    print("  ✓ Set and workout session deleted.")

    # -------------------------------------------------------------------------
    # 4. Progress Workflow
    # -------------------------------------------------------------------------
    print("\n[Workflow 4] Testing Progress Workflow (Daily, Steps, Reports)...")
    steps_res = client.post('/api/v1/progress/steps/', {'steps': 8500})
    assert steps_res.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]

    daily_prog = client.get('/api/v1/progress/daily/')
    assert daily_prog.status_code == status.HTTP_200_OK

    weekly_prog = client.get('/api/v1/progress/weekly/')
    assert weekly_prog.status_code == status.HTTP_200_OK

    monthly_prog = client.get('/api/v1/progress/monthly/')
    assert monthly_prog.status_code == status.HTTP_200_OK
    print("  ✓ Steps logged, daily/weekly/monthly reports generated successfully.")

    # -------------------------------------------------------------------------
    # 5. Recipes Workflow
    # -------------------------------------------------------------------------
    print("\n[Workflow 5] Testing Recipes Workflow...")
    recipes_res = client.get('/api/v1/recipes/')
    assert recipes_res.status_code == status.HTTP_200_OK
    recipes_list = recipes_res.data if isinstance(recipes_res.data, list) else recipes_res.data.get('results', [])
    assert len(recipes_list) > 0, "Recipes catalogue must not be empty"
    first_recipe = recipes_list[0]

    recipe_detail = client.get(f'/api/v1/recipes/{first_recipe["id"]}/')
    assert recipe_detail.status_code == status.HTTP_200_OK
    assert 'ingredients' in recipe_detail.data
    assert 'method' in recipe_detail.data
    print(f"  ✓ Recipes catalogue and recipe details loaded ({first_recipe['name']}).")

    # -------------------------------------------------------------------------
    # 6. Admin Permissions & Security
    # -------------------------------------------------------------------------
    print("\n[Workflow 6] Testing Admin Security...")
    # Normal user is denied
    admin_check = client.get('/api/v1/admin/dashboard/')
    assert admin_check.status_code == status.HTTP_403_FORBIDDEN
    print("  ✓ Authenticated non-superuser denied access to admin dashboard (403).")

    # Superuser gets access
    superuser = User.objects.filter(is_superuser=True).first()
    if superuser:
        client.force_authenticate(user=superuser)
        admin_dashboard = client.get('/api/v1/admin/dashboard/')
        assert admin_dashboard.status_code == status.HTTP_200_OK
        assert admin_dashboard.data['users'] > 0
        print("  ✓ Superuser granted full access to admin dashboard metrics.")

    # Clean temporary audit user
    User.objects.filter(username=test_username).delete()

    print("\n=== ALL E2E WORKFLOW TESTS PASSED 100%! ===")

if __name__ == '__main__':
    run_e2e_tests()
