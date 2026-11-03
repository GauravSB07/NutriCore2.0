import os
import sys
from urllib.parse import urlparse
from dotenv import dotenv_values

# ------------------------------------------------------------------------------
# 1. Strict Isolation & Pre-flight Security Verification
# ------------------------------------------------------------------------------
print("=" * 80)
print("STAGE 1: MUMBAI DATABASE SCHEMA MIGRATION & CATALOGUE FIXTURE IMPORT")
print("=" * 80)

# Load environment values independently
source_env = dotenv_values('.env')
dest_env = dotenv_values('.env.mumbai')

source_db_url = source_env.get('DATABASE_URL')
dest_db_url = dest_env.get('MUMBAI_DATABASE_URL')

if not dest_db_url:
    print("FATAL ERROR: MUMBAI_DATABASE_URL not found in .env.mumbai! Aborting.")
    sys.exit(1)

source_parsed = urlparse(source_db_url) if source_db_url else None
dest_parsed = urlparse(dest_db_url)

source_host = source_parsed.hostname if source_parsed else None
dest_host = dest_parsed.hostname

print(f"\n[Security Check] Source host:      {source_host}")
print(f"[Security Check] Destination host: {dest_host}")

# Strict host assertions
if dest_host != "aws-0-ap-south-1.pooler.supabase.com":
    print(f"FATAL ERROR: Destination host '{dest_host}' is NOT 'aws-0-ap-south-1.pooler.supabase.com'!")
    sys.exit(1)

if source_host and dest_host == source_host:
    print("FATAL ERROR: Destination host matches Source host! Aborting to protect source.")
    sys.exit(1)

if "eu-west-1" in dest_host:
    print("FATAL ERROR: Destination host contains 'eu-west-1'! Aborting.")
    sys.exit(1)

print("[Security Check] Destination host verified: CONFIRMED Mumbai (ap-south-1).")
print("[Security Check] Source protection verified: Ireland source will NOT be touched.")

# ------------------------------------------------------------------------------
# 2. Configure Django Environment explicitly for Mumbai
# ------------------------------------------------------------------------------
os.environ['DATABASE_URL'] = dest_db_url
os.environ['DISABLE_SERVER_SIDE_CURSORS'] = "True"
os.environ['DB_CONN_MAX_AGE'] = "0"
os.environ['DJANGO_SETTINGS_MODULE'] = 'NutriCore.settings'

# Add project root to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import django
import dj_database_url
from django.conf import settings

# Override database configuration before Django setup
django.setup()

# Explicitly ensure the default connection points to Mumbai
mumbai_db_config = dj_database_url.parse(
    dest_db_url,
    conn_max_age=0,
    conn_health_checks=False,
    ssl_require=True,
)
mumbai_db_config['DISABLE_SERVER_SIDE_CURSORS'] = True
mumbai_db_config.setdefault('OPTIONS', {})['sslmode'] = 'require'

settings.DATABASES['default'] = mumbai_db_config

from django.db import connection, connections
from django.core.management import call_command

# ------------------------------------------------------------------------------
# 3. Verify Live Active Connection
# ------------------------------------------------------------------------------
print("\n" + "-" * 50)
print("[Pre-flight Connection Verification]")
print("-" * 50)

active_host = connection.settings_dict.get('HOST')
print(f"Active Django default connection HOST: {active_host}")
if active_host != "aws-0-ap-south-1.pooler.supabase.com":
    print(f"FATAL ERROR: Active connection host '{active_host}' does NOT match Mumbai! Aborting.")
    sys.exit(1)

with connection.cursor() as cursor:
    cursor.execute("SELECT 1;")
    res = cursor.fetchone()
    if res[0] != 1:
        print("FATAL ERROR: SELECT 1 failed on Mumbai database!")
        sys.exit(1)
    
    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
    initial_tables = [row[0] for row in cursor.fetchall()]

print(f"Live database connection: SUCCESS")
print(f"Existing public tables before migration: {len(initial_tables)}")
if initial_tables:
    print(f"Warning: Destination has existing tables: {initial_tables}")
else:
    print("Verified: Destination is completely clean (0 public tables).")

# ------------------------------------------------------------------------------
# 4. Execute Schema Migrations
# ------------------------------------------------------------------------------
print("\n" + "=" * 80)
print("EXECUTING DJANGO MIGRATIONS AGAINST MUMBAI DATABASE")
print("=" * 80)

try:
    call_command('migrate', verbosity=2, interactive=False)
    print("\n>>> Django migrations completed successfully.")
except Exception as e:
    print(f"\nFATAL ERROR during migrate: {e}")
    sys.exit(1)

# Check migration status
print("\n" + "-" * 50)
print("[Migration Status (showmigrations)]")
print("-" * 50)
call_command('showmigrations')

# ------------------------------------------------------------------------------
# 5. Execute Catalogue Fixture Import
# ------------------------------------------------------------------------------
print("\n" + "=" * 80)
print("LOADING CATALOGUE FIXTURE (data.json) INTO MUMBAI DATABASE")
print("=" * 80)

fixture_file = os.path.join(BASE_DIR, 'data.json')
if not os.path.exists(fixture_file):
    print(f"FATAL ERROR: Fixture file not found at: {fixture_file}")
    sys.exit(1)

try:
    call_command('loaddata', fixture_file, verbosity=2)
    print("\n>>> Catalogue fixture loaded successfully.")
except Exception as e:
    print(f"\nFATAL ERROR during loaddata: {e}")
    sys.exit(1)

# ------------------------------------------------------------------------------
# 6. Detailed Post-Import Verification
# ------------------------------------------------------------------------------
print("\n" + "=" * 80)
print("POST-IMPORT INTEGRITY & CATALOGUE VERIFICATION")
print("=" * 80)

from django.contrib.auth.models import User
from Users.models import Profile
from Nutrition.models import Category, Food, MealLog, WaterIntake
from Workouts.models import MuscleGroup, SubMuscle, Exercise, WorkoutSession, WorkoutSet
from Progress.models import StepsLog
from Recipes.models import RecipeCategory, Recipe

# 1. Catalogue Model Counts
counts = {
    'Nutrition.category': Category.objects.count(),
    'Nutrition.food': Food.objects.count(),
    'Workouts.musclegroup': MuscleGroup.objects.count(),
    'Workouts.submuscle': SubMuscle.objects.count(),
    'Workouts.exercise': Exercise.objects.count(),
    'Recipes.recipecategory': RecipeCategory.objects.count(),
    'Recipes.recipe': Recipe.objects.count(),
}

expected_counts = {
    'Nutrition.category': 18,
    'Nutrition.food': 270,
    'Workouts.musclegroup': 8,
    'Workouts.submuscle': 27,
    'Workouts.exercise': 87,
    'Recipes.recipecategory': 11,
    'Recipes.recipe': 27,
}

total_catalogue_records = sum(counts.values())
expected_total = 448

print("\n[1] Catalogue Model Record Counts:")
print("-" * 60)
all_counts_match = True
for model_name, expected in expected_counts.items():
    actual = counts.get(model_name, 0)
    match = (actual == expected)
    status_str = "MATCH" if match else "MISMATCH"
    if not match:
        all_counts_match = False
    print(f"  • {model_name:<25}: Actual = {actual:3d} | Expected = {expected:3d} [{status_str}]")

print(f"\n  • Total Catalogue Entities: {total_catalogue_records} (Expected: {expected_total}) [{'MATCH' if total_catalogue_records == expected_total else 'MISMATCH'}]")

# 2. Food-Category Many-to-Many Association Count
with connection.cursor() as cursor:
    cursor.execute('SELECT COUNT(*) FROM "Nutrition_food_categories";')
    m2m_count = cursor.fetchone()[0]

expected_m2m = 535
m2m_match = (m2m_count == expected_m2m)
print(f"\n[2] Food-Category M2M Associations:")
print(f"  • Actual relationships: {m2m_count} | Expected: {expected_m2m} [{'MATCH' if m2m_match else 'MISMATCH'}]")

# 3. Foreign Key Integrity & Orphan Checks
print("\n[3] Foreign Key Integrity & Orphan Checks:")
orphan_submuscles = SubMuscle.objects.filter(muscle_group__isnull=True).count()
orphan_exercises = Exercise.objects.filter(sub_muscle__isnull=True).count()
orphan_recipes = Recipe.objects.filter(category__isnull=True).count()

print(f"  • SubMuscles without MuscleGroup: {orphan_submuscles} (Expected: 0)")
print(f"  • Exercises without SubMuscle:    {orphan_exercises} (Expected: 0)")
print(f"  • Recipes without RecipeCategory: {orphan_recipes} (Expected: 0)")

# 4. Primary Key Range and Continuity Checks
print("\n[4] Primary Key Checks:")
print(f"  • Categories PK Range:   Min={Category.objects.order_by('id').first().id}, Max={Category.objects.order_by('id').last().id}, Count={counts['Nutrition.category']}")
print(f"  • Foods PK Range:        Min={Food.objects.order_by('id').first().id}, Max={Food.objects.order_by('id').last().id}, Count={counts['Nutrition.food']}")
print(f"  • MuscleGroups PK Range: Min={MuscleGroup.objects.order_by('id').first().id}, Max={MuscleGroup.objects.order_by('id').last().id}, Count={counts['Workouts.musclegroup']}")
print(f"  • SubMuscles PK Range:   Min={SubMuscle.objects.order_by('id').first().id}, Max={SubMuscle.objects.order_by('id').last().id}, Count={counts['Workouts.submuscle']}")
print(f"  • Exercises PK Range:    Min={Exercise.objects.order_by('id').first().id}, Max={Exercise.objects.order_by('id').last().id}, Count={counts['Workouts.exercise']}")
print(f"  • Recipes PK Range:      Min={Recipe.objects.order_by('id').first().id}, Max={Recipe.objects.order_by('id').last().id}, Count={counts['Recipes.recipe']}")

# 5. User Data Protection & Privacy Verification
print("\n[5] Personal User Data Protection Verification:")
print("-" * 60)
user_count = User.objects.count()
profile_count = Profile.objects.count()
meallog_count = MealLog.objects.count()
water_count = WaterIntake.objects.count()
steps_count = StepsLog.objects.count()
session_count = WorkoutSession.objects.count()
set_count = WorkoutSet.objects.count()

zero_personal_data = (
    user_count == 0 and
    profile_count == 0 and
    meallog_count == 0 and
    water_count == 0 and
    steps_count == 0 and
    session_count == 0 and
    set_count == 0
)

print(f"  • Users (auth_user):             {user_count} (Expected: 0)")
print(f"  • User Profiles (Users_profile): {profile_count} (Expected: 0)")
print(f"  • Meal Logs (Nutrition_meallog): {meallog_count} (Expected: 0)")
print(f"  • Water Logs (Nutrition_water):  {water_count} (Expected: 0)")
print(f"  • Steps Logs (Progress_stepslog):{steps_count} (Expected: 0)")
print(f"  • Workout Sessions:              {session_count} (Expected: 0)")
print(f"  • Workout Sets:                  {set_count} (Expected: 0)")
print(f"  • Personal Data Excluded:        {'CONFIRMED (Zero personal records)' if zero_personal_data else 'FAILED'}")

print("\n" + "=" * 80)
print("STAGE 1 SUMMARY")
print("=" * 80)

stage1_ok = (
    all_counts_match and
    m2m_match and
    orphan_submuscles == 0 and
    orphan_exercises == 0 and
    orphan_recipes == 0 and
    zero_personal_data
)

print(f"Overall Stage 1 Migration Result: {'PASS' if stage1_ok else 'NEEDS ATTENTION'}")

