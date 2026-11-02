import os
import sys
import django

# Set up Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NutriCore.settings')
django.setup()

import json
from django.contrib.auth.models import User
from Users.models import Profile
from Nutrition.models import Category, Food, MealLog, WaterIntake
from Workouts.models import MuscleGroup, SubMuscle, Exercise, WorkoutSession, WorkoutSet
from Progress.models import StepsLog
from Recipes.models import RecipeCategory, Recipe

try:
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
    HAS_JWT_BLACKLIST = True
except ImportError:
    HAS_JWT_BLACKLIST = False

print("=" * 80)
print("PHASE 4 - STEP 24: NON-DESTRUCTIVE TEST DATA CLEANUP AUDIT")
print("=" * 80)

# 1. User Accounts Detailed Audit
users = User.objects.all().order_by('id')
print(f"\n[1] TOTAL USERS FOUND IN DATABASE: {users.count()}")
print("-" * 80)

user_data_list = []
for u in users:
    profile = getattr(u, 'profile', None)
    profile_info = {
        'exists': profile is not None,
        'id': profile.id if profile else None,
        'profile_image': str(profile.profile_image) if profile and profile.profile_image else None,
        'weight': float(profile.weight) if profile and profile.weight is not None else None,
        'start_weight': float(profile.start_weight) if profile and profile.start_weight is not None else None,
        'target_weight': float(profile.target_weight) if profile and profile.target_weight is not None else None,
        'daily_calorie_target': float(profile.daily_calorie_target) if profile else None,
        'daily_protein_target': float(profile.daily_protein_target) if profile else None,
        'daily_water_goal': float(profile.daily_water_goal) if profile else None,
        'daily_steps_target': profile.daily_steps_target if profile else None,
        'goal': profile.goal if profile else None,
        'points': profile.points if profile else None,
        'is_onboarded': profile.is_onboarded if profile else None,
    }

    # Meal logs
    meals = MealLog.objects.filter(user=u).order_by('id')
    meal_details = []
    for m in meals:
        meal_details.append({
            'id': m.id,
            'food_id': m.food_id,
            'food_name': m.food.name if m.food else 'Unknown',
            'quantity': float(m.quantity),
            'unit': m.unit,
            'date': str(m.date),
            'is_cheat': m.is_cheat,
            'calories': float(m.calories) if m.calories is not None else None,
            'protein': float(m.protein) if m.protein is not None else None,
        })
    cheat_meal_ids = [m['id'] for m in meal_details if m['is_cheat']]

    # Water records
    waters = WaterIntake.objects.filter(user=u).order_by('id')
    water_details = [{'id': w.id, 'amount_ml': float(w.amount), 'date': str(w.date)} for w in waters]

    # Steps records
    steps = StepsLog.objects.filter(user=u).order_by('id')
    step_details = [{'id': s.id, 'steps': s.steps, 'date': str(s.date)} for s in steps]

    # Workouts: Sessions and Sets
    sessions = WorkoutSession.objects.filter(user=u).order_by('id')
    session_details = []
    all_sets_details = []
    for s in sessions:
        sets = WorkoutSet.objects.filter(session=s).order_by('id')
        s_set_list = []
        for st in sets:
            set_item = {
                'id': st.id,
                'session_id': s.id,
                'exercise_id': st.exercise_id,
                'exercise_name': st.exercise.name if st.exercise else 'Unknown',
                'sub_muscle_id': st.sub_muscle_id,
                'set_number': st.set_number,
                'reps': st.reps,
                'weight': float(st.weight),
            }
            s_set_list.append(set_item)
            all_sets_details.append(set_item)

        session_details.append({
            'session_id': s.id,
            'sub_muscle_id': s.sub_muscle_id,
            'sub_muscle_name': s.sub_muscle.name if s.sub_muscle else 'Unknown',
            'date': str(s.date),
            'sets_count': len(s_set_list),
            'sets': s_set_list,
        })

    # JWT Tokens
    jwt_outstanding = []
    jwt_blacklisted = []
    if HAS_JWT_BLACKLIST:
        ot = OutstandingToken.objects.filter(user=u)
        jwt_outstanding = list(ot.values_list('id', flat=True))
        bt = BlacklistedToken.objects.filter(token__user=u)
        jwt_blacklisted = list(bt.values_list('id', flat=True))

    # Food created_by check
    created_foods = list(Food.objects.filter(created_by=u).values('id', 'name'))

    u_info = {
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'date_joined': str(u.date_joined),
        'last_login': str(u.last_login) if u.last_login else None,
        'is_staff': u.is_staff,
        'is_superuser': u.is_superuser,
        'profile': profile_info,
        'meal_logs_count': len(meal_details),
        'meal_logs': meal_details,
        'cheat_meal_count': len(cheat_meal_ids),
        'cheat_meal_ids': cheat_meal_ids,
        'water_count': len(water_details),
        'water_records': water_details,
        'steps_count': len(step_details),
        'steps_records': step_details,
        'sessions_count': len(session_details),
        'sessions': session_details,
        'total_sets_count': len(all_sets_details),
        'sets': all_sets_details,
        'jwt_outstanding_tokens_count': len(jwt_outstanding),
        'jwt_outstanding_token_ids': jwt_outstanding,
        'jwt_blacklisted_tokens_count': len(jwt_blacklisted),
        'jwt_blacklisted_token_ids': jwt_blacklisted,
        'created_foods': created_foods,
    }
    user_data_list.append(u_info)
    print(f"User ID: {u.id:2d} | Username: {u.username:<24} | Staff: {u.is_staff!s:<5} | Superuser: {u.is_superuser!s:<5}")
    print(f"  Joined: {u.date_joined} | Email: {u.email}")
    print(f"  Profile ID: {profile_info['id']} | Image: {profile_info['profile_image']} | Target Cals: {profile_info['daily_calorie_target']}")
    print(f"  Meals: {len(meal_details)} (Cheat: {len(cheat_meal_ids)}) | Water: {len(water_details)} | Steps: {len(step_details)} | Sessions: {len(session_details)} (Sets: {len(all_sets_details)}) | JWT: {len(jwt_outstanding)}")

# Check sequence gaps in Users table
all_ids = sorted(list(User.objects.values_list('id', flat=True)))
print(f"\nExisting User IDs in DB: {all_ids}")
if all_ids:
    min_id, max_id = min(all_ids), max(all_ids)
    missing_ids = [i for i in range(min_id, max_id + 1) if i not in all_ids]
    print(f"Missing User IDs in sequence [{min_id}..{max_id}]: {missing_ids}")

# 2. Catalogue Inventory Audit
print("\n" + "=" * 80)
print("[2] CATALOGUE INVENTORY AUDIT")
print("-" * 80)

food_cats = Category.objects.all()
foods = Food.objects.all()
recipe_cats = RecipeCategory.objects.all()
recipes = Recipe.objects.all()
muscle_groups = MuscleGroup.objects.all()
sub_muscles = SubMuscle.objects.all()
exercises = Exercise.objects.all()

print(f"Food Categories:   {food_cats.count()}")
print(f"Foods:             {foods.count()}")
print(f"Recipe Categories: {recipe_cats.count()}")
print(f"Recipes:           {recipes.count()}")
print(f"Muscle Groups:     {muscle_groups.count()}")
print(f"SubMuscles:        {sub_muscles.count()}")
print(f"Exercises:         {exercises.count()}")

catalogue_test_candidates = {
    'food_categories': list(food_cats.filter(name__icontains='test').values('id', 'name')),
    'foods': list(foods.filter(name__icontains='test').values('id', 'name')),
    'recipe_categories': list(recipe_cats.filter(name__icontains='test').values('id', 'name')),
    'recipes': list(recipes.filter(name__icontains='test').values('id', 'name')),
    'muscle_groups': list(muscle_groups.filter(name__icontains='test').values('id', 'name')),
    'sub_muscles': list(sub_muscles.filter(name__icontains='test').values('id', 'name')),
    'exercises': list(exercises.filter(name__icontains='test').values('id', 'name')),
}
print(f"\nCatalogue items containing 'test' (case-insensitive) in name:")
for cat_type, items in catalogue_test_candidates.items():
    print(f"  - {cat_type}: {len(items)} found {items if items else ''}")

# Check foods with created_by
foods_with_creator = Food.objects.filter(created_by__isnull=False)
print(f"\nFoods with created_by specified: {foods_with_creator.count()}")
for f in foods_with_creator:
    print(f"  Food ID {f.id}: {f.name} (Creator: {f.created_by.username})")

# 3. Media & Storage Audit
print("\n" + "=" * 80)
print("[3] MEDIA & STORAGE AUDIT")
print("-" * 80)

profile_images = []
for p in Profile.objects.filter(profile_image__isnull=False).exclude(profile_image=''):
    profile_images.append({
        'profile_id': p.id,
        'user_id': p.user_id,
        'username': p.user.username if p.user else None,
        'image': str(p.profile_image),
    })

food_images_test = []
for f in Food.objects.filter(image__isnull=False).exclude(image=''):
    if 'test' in str(f.image).lower() or 'test' in f.name.lower():
        food_images_test.append({'food_id': f.id, 'name': f.name, 'image': str(f.image)})

recipe_images_test = []
for r in Recipe.objects.filter(image__isnull=False).exclude(image=''):
    if 'test' in str(r.image).lower() or 'test' in r.name.lower():
        recipe_images_test.append({'recipe_id': r.id, 'name': r.name, 'image': str(r.image)})

exercise_images_test = []
for e in Exercise.objects.filter(image__isnull=False).exclude(image=''):
    if 'test' in str(e.image).lower() or 'test' in e.name.lower():
        exercise_images_test.append({'exercise_id': e.id, 'name': e.name, 'image': str(e.image)})

print(f"Profiles with uploaded profile_image: {len(profile_images)}")
for pi in profile_images:
    print(f"  Profile ID {pi['profile_id']} (User: {pi['username']}): {pi['image']}")

print(f"Catalogue items with 'test' in image: {len(food_images_test) + len(recipe_images_test) + len(exercise_images_test)}")

# 4. Dump full detailed inventory to JSON
dump_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'step24_inventory_dump.json')
with open(dump_path, 'w', encoding='utf-8') as f:
    json.dump({
        'users': user_data_list,
        'catalogue_counts': {
            'food_categories': food_cats.count(),
            'foods': foods.count(),
            'recipe_categories': recipe_cats.count(),
            'recipes': recipes.count(),
            'muscle_groups': muscle_groups.count(),
            'sub_muscles': sub_muscles.count(),
            'exercises': exercises.count(),
        },
        'catalogue_test_candidates': catalogue_test_candidates,
        'profile_images': profile_images,
        'missing_user_ids': missing_ids if all_ids else [],
    }, f, indent=2, ensure_ascii=False)

print(f"\nFull detailed inventory dump saved to: {dump_path}")
print("=" * 80)
