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
from Nutrition.models import Food, Category, MealLog
from Workouts.models import MuscleGroup, SubMuscle, Exercise
from Recipes.models import Recipe, RecipeCategory
from Users.models import Profile

User = get_user_model()

def run_tests():
    print("=== Step 22: NutriCore Admin Panel Integration Verification ===")
    client = APIClient()

    # 1. Unauthenticated checks
    print("\n[Test 1] Testing Unauthenticated access to Admin APIs...")
    res = client.get('/api/v1/admin/dashboard/')
    assert res.status_code == status.HTTP_401_UNAUTHORIZED, f"Expected 401, got {res.status_code}"

    res = client.get('/api/v1/admin/users/')
    assert res.status_code == status.HTTP_401_UNAUTHORIZED, f"Expected 401, got {res.status_code}"

    res = client.get('/api/v1/admin/profiles/')
    assert res.status_code == status.HTTP_401_UNAUTHORIZED, f"Expected 401, got {res.status_code}"

    res = client.get('/api/v1/admin/meals/')
    assert res.status_code == status.HTTP_401_UNAUTHORIZED, f"Expected 401, got {res.status_code}"
    print("✓ Unauthenticated requests return 401 Unauthorized.")

    # 2. Normal authenticated user checks (Non-superuser)
    print("\n[Test 2] Testing Normal Authenticated User access to Admin APIs...")
    normal_user = User.objects.filter(is_superuser=False, is_staff=False).first()
    if not normal_user:
        normal_user = User.objects.create_user(username='test_normal_step22', password='password123')

    client.force_authenticate(user=normal_user)

    res = client.get('/api/v1/admin/dashboard/')
    assert res.status_code == status.HTTP_403_FORBIDDEN, f"Expected 403, got {res.status_code}"

    res = client.get('/api/v1/admin/users/')
    assert res.status_code == status.HTTP_403_FORBIDDEN, f"Expected 403, got {res.status_code}"

    res = client.get('/api/v1/admin/profiles/')
    assert res.status_code == status.HTTP_403_FORBIDDEN, f"Expected 403, got {res.status_code}"

    res = client.get('/api/v1/admin/meals/')
    assert res.status_code == status.HTTP_403_FORBIDDEN, f"Expected 403, got {res.status_code}"
    print("✓ Non-superuser requests return 403 Forbidden.")

    # 3. Staff but non-superuser check
    print("\n[Test 3] Testing Staff (Non-Superuser) access...")
    staff_user = User.objects.filter(is_staff=True, is_superuser=False).first()
    if not staff_user:
        staff_user = User.objects.create_user(username='test_staff_step22', password='password123', is_staff=True)
    
    client.force_authenticate(user=staff_user)
    res = client.get('/api/v1/admin/dashboard/')
    assert res.status_code == status.HTTP_403_FORBIDDEN, f"Staff without superuser must receive 403, got {res.status_code}"
    print("✓ Staff without is_superuser receives 403 Forbidden.")

    # 4. Superuser checks
    print("\n[Test 4] Testing Superuser access and Dashboard Metrics...")
    superuser = User.objects.filter(is_superuser=True).first()
    if not superuser:
        superuser = User.objects.create_superuser(username='test_admin_step22', password='password123', email='admin@test.com')

    client.force_authenticate(user=superuser)

    res = client.get('/api/v1/admin/dashboard/')
    assert res.status_code == status.HTTP_200_OK, f"Expected 200, got {res.status_code}"
    data = res.data
    print("Dashboard metrics:", data)
    for field in ['users', 'profiles', 'foods', 'food_categories', 'recipes', 'recipe_categories', 'exercises', 'muscle_groups', 'submuscles', 'meals_logged_today']:
        assert field in data, f"Missing dashboard metric {field}"
    print("✓ Dashboard metrics loaded successfully with all expected metric counts.")

    # 5. User & Profile list endpoints
    print("\n[Test 5] Testing Admin User & Profile Endpoints...")
    res = client.get('/api/v1/admin/users/')
    assert res.status_code == status.HTTP_200_OK
    user_results = res.data if isinstance(res.data, list) else res.data.get('results', [])
    assert len(user_results) > 0, "Users list should return records"

    res = client.get('/api/v1/admin/profiles/')
    assert res.status_code == status.HTTP_200_OK
    prof_results = res.data if isinstance(res.data, list) else res.data.get('results', [])
    print(f"✓ Found {len(user_results)} users and {len(prof_results)} profiles via admin API.")

    # 6. Global Meal logs list
    print("\n[Test 6] Testing Admin Meal Logs Inspection...")
    res = client.get('/api/v1/admin/meals/')
    assert res.status_code == status.HTTP_200_OK
    meal_results = res.data if isinstance(res.data, list) else res.data.get('results', [])
    print(f"✓ Global meal logs accessible: {len(meal_results)} logs returned.")

    # 7. Food Catalogue CRUD
    print("\n[Test 7] Testing Food Category and Food CRUD...")
    # Create test category
    res = client.post('/api/v1/nutrition/categories/', {'name': 'Test Step22 Cat'})
    assert res.status_code == status.HTTP_201_CREATED, f"Failed to create category: {res.data}"
    cat_id = res.data['id']

    # Create test food
    res = client.post('/api/v1/nutrition/foods/', {
        'name': 'Test Step22 Apple',
        'calories_per_100g': 52.0,
        'protein_per_100g': 0.3,
        'unit_type': 'g',
        'categories': [cat_id]
    })
    assert res.status_code == status.HTTP_201_CREATED, f"Failed to create food: {res.data}"
    food_id = res.data['id']

    # Update food
    res = client.patch(f'/api/v1/nutrition/foods/{food_id}/', {'name': 'Test Step22 Apple Updated'})
    assert res.status_code == status.HTTP_200_OK, f"Failed to update food: {res.data}"
    assert res.data['name'] == 'Test Step22 Apple Updated'

    # Cleanup test food and category
    client.delete(f'/api/v1/nutrition/foods/{food_id}/')
    client.delete(f'/api/v1/nutrition/categories/{cat_id}/')
    print("✓ Food and Category CRUD operations verified.")

    # 8. Workouts Catalogue CRUD
    print("\n[Test 8] Testing Workout Muscle Group, SubMuscle, and Exercise CRUD...")
    res = client.post('/api/v1/workouts/muscles/', {'name': 'Test Step22 Muscle'})
    assert res.status_code == status.HTTP_201_CREATED, f"Failed to create muscle: {res.data}"
    muscle_id = res.data['id']

    res = client.post('/api/v1/workouts/submuscles/', {'name': 'Test Step22 Sub', 'muscle_group': muscle_id})
    assert res.status_code == status.HTTP_201_CREATED, f"Failed to create submuscle: {res.data}"
    sub_id = res.data['id']

    res = client.post('/api/v1/workouts/exercises/', {
        'name': 'Test Step22 Press',
        'sub_muscle': sub_id,
        'equipment': 'Dumbbells',
        'description': 'Test description',
        'steps': 'Step 1: Press.'
    })
    assert res.status_code == status.HTTP_201_CREATED, f"Failed to create exercise: {res.data}"
    ex_id = res.data['id']

    # Cleanup
    client.delete(f'/api/v1/workouts/exercises/{ex_id}/')
    client.delete(f'/api/v1/workouts/submuscles/{sub_id}/')
    client.delete(f'/api/v1/workouts/muscles/{muscle_id}/')
    print("✓ Exercise, Submuscle, and Muscle Group CRUD operations verified.")

    # 9. Recipes Catalogue CRUD
    print("\n[Test 9] Testing Recipe Category and Recipe CRUD...")
    res = client.post('/api/v1/recipes/categories/', {'name': 'Test Step22 Rec Cat'})
    assert res.status_code == status.HTTP_201_CREATED, f"Failed to create recipe category: {res.data}"
    rec_cat_id = res.data['id']

    res = client.post('/api/v1/recipes/', {
        'name': 'Test Step22 Salad',
        'category_id': rec_cat_id,
        'calories': 250.0,
        'protein': 12.0,
        'price': 150.0,
        'ingredients': 'Greens; Tomatoes; Dressing',
        'method': 'Chop greens. Mix dressing. Toss and serve.'
    })
    assert res.status_code == status.HTTP_201_CREATED, f"Failed to create recipe: {res.data}"
    rec_id = res.data['id']

    # Cleanup
    client.delete(f'/api/v1/recipes/{rec_id}/')
    client.delete(f'/api/v1/recipes/categories/{rec_cat_id}/')
    print("✓ Recipe and Recipe Category CRUD operations verified.")

    # 10. Self-deletion and last superuser protection
    print("\n[Test 10] Testing Last Superuser / Self-Deletion Safeguards...")
    res = client.delete(f'/api/v1/admin/users/{superuser.id}/')
    # Should be rejected with 400 Bad Request
    assert res.status_code == status.HTTP_400_BAD_REQUEST, f"Expected 400 for self/last superuser deletion, got {res.status_code}"
    print(f"✓ Protection confirmed: {res.data}")

    # Clean temporary test users created in this script
    if normal_user.username == 'test_normal_step22':
        normal_user.delete()
    if staff_user.username == 'test_staff_step22':
        staff_user.delete()

    print("\n=== ALL 10 STEP 22 VERIFICATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == '__main__':
    run_tests()
