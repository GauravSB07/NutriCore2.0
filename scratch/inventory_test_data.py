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

from django.contrib.auth import get_user_model
from Nutrition.models import Food, Category, MealLog, WaterIntake
from Progress.models import StepsLog
from Workouts.models import MuscleGroup, SubMuscle, Exercise, WorkoutSession, WorkoutSet
from Recipes.models import Recipe, RecipeCategory
from Users.models import Profile

User = get_user_model()

def inventory():
    print("=== NUTRICORE TEST DATA INVENTORY AUDIT ===")

    # 1. Users
    print("\n--- Users Inventory ---")
    all_users = User.objects.all().order_by('id')
    for u in all_users:
        is_test = any(prefix in u.username.lower() for prefix in ['test', 'auth_user', 'demo', 'temp'])
        print(f"User ID: {u.id} | Username: {u.username} | Email: {u.email} | Staff: {u.is_staff} | Superuser: {u.is_superuser} | Test Account: {is_test}")

    # 2. Meal Logs
    print("\n--- Meal Logs Inventory ---")
    all_meals = MealLog.objects.select_related('user', 'food').all().order_by('id')
    for m in all_meals:
        is_test_user = any(p in m.user.username.lower() for p in ['test', 'auth_user'])
        print(f"MealLog ID: {m.id} | User: {m.user.username} (ID: {m.user.id}) | Food: {m.food.name} | Date: {m.date} | Cheat: {m.is_cheat} | Test: {is_test_user}")

    # 3. Water Intake
    print("\n--- Water Intake Inventory ---")
    all_water = WaterIntake.objects.select_related('user').all().order_by('id')
    for w in all_water:
        is_test_user = any(p in w.user.username.lower() for p in ['test', 'auth_user'])
        print(f"WaterIntake ID: {w.id} | User: {w.user.username} | Amount: {w.amount}ml | Date: {w.date} | Test: {is_test_user}")

    # 4. Steps Logs
    print("\n--- Steps Logs Inventory ---")
    all_steps = StepsLog.objects.select_related('user').all().order_by('id')
    for sl in all_steps:
        is_test_user = any(p in sl.user.username.lower() for p in ['test', 'auth_user'])
        print(f"StepsLog ID: {sl.id} | User: {sl.user.username} | Date: {sl.date} | Steps: {sl.steps} | Test: {is_test_user}")

    # 5. Workout Sessions & Sets
    print("\n--- Workout Sessions Inventory ---")
    all_sessions = WorkoutSession.objects.select_related('user').prefetch_related('sets').all().order_by('id')
    for ws in all_sessions:
        is_test_user = any(p in ws.user.username.lower() for p in ['test', 'auth_user'])
        sets_count = ws.sets.count()
        print(f"WorkoutSession ID: {ws.id} | User: {ws.user.username} | Date: {ws.date} | Sets: {sets_count} | Test: {is_test_user}")

    # 6. Catalogue records with 'test' in name
    print("\n--- Catalogue Test Entries ---")
    test_foods = Food.objects.filter(name__icontains='test')
    for f in test_foods:
        print(f"Food ID: {f.id} | Name: {f.name}")

    test_cats = Category.objects.filter(name__icontains='test')
    for c in test_cats:
        print(f"Food Category ID: {c.id} | Name: {c.name}")

    test_exercises = Exercise.objects.filter(name__icontains='test')
    for ex in test_exercises:
        print(f"Exercise ID: {ex.id} | Name: {ex.name}")

    test_muscles = MuscleGroup.objects.filter(name__icontains='test')
    for m in test_muscles:
        print(f"MuscleGroup ID: {m.id} | Name: {m.name}")

    test_submuscles = SubMuscle.objects.filter(name__icontains='test')
    for sm in test_submuscles:
        print(f"SubMuscle ID: {sm.id} | Name: {sm.name}")

    test_recipes = Recipe.objects.filter(name__icontains='test')
    for r in test_recipes:
        print(f"Recipe ID: {r.id} | Name: {r.name}")

    test_rec_cats = RecipeCategory.objects.filter(name__icontains='test')
    for rc in test_rec_cats:
        print(f"Recipe Category ID: {rc.id} | Name: {rc.name}")

    print("\n=== INVENTORY COMPLETE (NO DATA MODIFIED) ===")

if __name__ == '__main__':
    inventory()
