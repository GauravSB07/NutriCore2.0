import os
import sys
import django
import uuid

# Configure Django environment
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NutriCore.settings')
django.setup()

from django.conf import settings
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

from django.contrib.auth.models import User
from rest_framework.test import APIClient
from Workouts.models import MuscleGroup, SubMuscle, Exercise, WorkoutSession, WorkoutSet
from Users.models import Profile

def run_tests():
    print("=" * 70)
    print("STEP 19: COMPLETE WORKOUT MODULE VERIFICATION SUITE")
    print("=" * 70)

    client = APIClient()
    uid = uuid.uuid4().hex[:8]

    # 1. Create isolated test users
    username = f"workout_user_{uid}"
    email = f"{username}@example.com"
    password = "SecurePassword123!"

    user = User.objects.create_user(username=username, email=email, password=password)
    Profile.objects.get_or_create(user=user)

    other_user = User.objects.create_user(username=f"other_wo_{uid}", email=f"other_{uid}@example.com", password=password)
    other_client = APIClient()

    # JWT Authentication
    login_res = client.post('/api/v1/auth/login/', {'username': username, 'password': password})
    assert login_res.status_code == 200, f"Login failed: {login_res.data}"
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_res.data['tokens']['access']}")

    other_login = other_client.post('/api/v1/auth/login/', {'username': f"other_wo_{uid}", 'password': password})
    assert other_login.status_code == 200
    other_client.credentials(HTTP_AUTHORIZATION=f"Bearer {other_login.data['tokens']['access']}")

    print("✔ Isolated test accounts created and authenticated via JWT")

    # 2. Test Muscle Groups Catalogue
    muscles_res = client.get('/api/v1/workouts/muscles/')
    assert muscles_res.status_code == 200, f"Muscles list failed: {muscles_res.data}"
    muscles = muscles_res.data if isinstance(muscles_res.data, list) else muscles_res.data.get('results', [])
    assert len(muscles) > 0, "No muscle groups found in catalogue"
    first_muscle = muscles[0]
    print(f"✔ GET /api/v1/workouts/muscles/ returned {len(muscles)} muscle groups (sample: {first_muscle['name']})")

    # 3. Test Sub-Muscles by Parent Muscle Group
    sub_res = client.get(f"/api/v1/workouts/submuscles/?muscle={first_muscle['id']}")
    assert sub_res.status_code == 200, f"Submuscles query failed: {sub_res.data}"
    submuscles = sub_res.data if isinstance(sub_res.data, list) else sub_res.data.get('results', [])
    print(f"✔ GET /api/v1/workouts/submuscles/?muscle={first_muscle['id']} returned {len(submuscles)} sub-muscles")

    target_sub = submuscles[0] if len(submuscles) > 0 else SubMuscle.objects.first()
    assert target_sub is not None, "Need at least one submuscle for testing"
    sub_id = target_sub['id'] if isinstance(target_sub, dict) else target_sub.id
    sub_name = target_sub['name'] if isinstance(target_sub, dict) else target_sub.name

    # 4. Test Exercises by Sub-Muscle
    ex_res = client.get(f"/api/v1/workouts/exercises/?sub_muscle={sub_id}")
    assert ex_res.status_code == 200, f"Exercises query failed: {ex_res.data}"
    exercises_data = ex_res.data.get('results', []) if isinstance(ex_res.data, dict) else ex_res.data
    print(f"✔ GET /api/v1/workouts/exercises/?sub_muscle={sub_id} returned {len(exercises_data)} exercises")

    target_exercise = exercises_data[0] if len(exercises_data) > 0 else None
    if not target_exercise:
        # Create test exercise
        created_ex = Exercise.objects.create(
            name=f"Test Incline Press {uid}",
            sub_muscle_id=sub_id,
            equipment="Dumbbell",
            description="Compound chest exercise targeting the clavicular head.",
            steps="1. Set bench to 30 degrees.\n2. Press dumbbells up.\n3. Lower with control."
        )
        ex_id = created_ex.id
        ex_name = created_ex.name
    else:
        ex_id = target_exercise['id']
        ex_name = target_exercise['name']

    # 5. Test Exercise Detail API
    detail_res = client.get(f"/api/v1/workouts/exercises/{ex_id}/")
    assert detail_res.status_code == 200, f"Exercise detail failed: {detail_res.data}"
    detail = detail_res.data
    assert detail['id'] == ex_id
    assert detail['name'] == ex_name
    assert 'steps' in detail
    assert 'equipment' in detail
    print(f"✔ GET /api/v1/workouts/exercises/{ex_id}/ returned detailed instructions and equipment info ({detail['equipment']})")

    # 6. Test Workout Session Creation
    session_post_res = client.post('/api/v1/workouts/sessions/', {
        'sub_muscle_id': sub_id,
    })
    assert session_post_res.status_code == 201, f"Session creation failed: {session_post_res.data}"
    session = session_post_res.data
    session_id = session['id']
    print(f"✔ POST /api/v1/workouts/sessions/ created session (id: {session_id}, sub_muscle: {sub_name})")

    # 7. Test Set Creation with volume formula: volume = reps * weight
    set_post_res = client.post(f"/api/v1/workouts/sessions/{session_id}/sets/", {
        'exercise_id': ex_id,
        'reps': 12,
        'weight': 30.0,
    })
    assert set_post_res.status_code == 201, f"Set creation failed: {set_post_res.data}"
    workout_set = set_post_res.data
    set_id = workout_set['id']
    expected_volume = 12 * 30.0
    assert abs(workout_set['volume'] - expected_volume) <= 0.01, f"Expected volume {expected_volume}, got {workout_set['volume']}"
    print(f"✔ POST /api/v1/workouts/sessions/{session_id}/sets/ logged Set 1: 12 reps x 30.0kg = {workout_set['volume']} kg volume")

    # Add second set
    set_2_res = client.post(f"/api/v1/workouts/sessions/{session_id}/sets/", {
        'exercise_id': ex_id,
        'reps': 10,
        'weight': 35.0,
    })
    assert set_2_res.status_code == 201
    set_2 = set_2_res.data
    set_2_id = set_2['id']
    assert abs(set_2['volume'] - (10 * 35.0)) <= 0.01
    print(f"✔ POST logged Set 2: 10 reps x 35.0kg = {set_2['volume']} kg volume")

    # 8. Test Set Update (PATCH)
    patch_res = client.patch(f"/api/v1/workouts/sets/{set_id}/", {
        'reps': 15,
        'weight': 32.5,
    })
    assert patch_res.status_code == 200, f"Set update failed: {patch_res.data}"
    updated_set = patch_res.data
    expected_updated_vol = 15 * 32.5
    assert abs(updated_set['volume'] - expected_updated_vol) <= 0.01
    print(f"✔ PATCH /api/v1/workouts/sets/{set_id}/ updated set: 15 reps x 32.5kg = {updated_set['volume']} kg volume")

    # 9. Test User Data Isolation
    other_session_get = other_client.get(f"/api/v1/workouts/sessions/{session_id}/")
    assert other_session_get.status_code == 404, "Data isolation breach: other user accessed workout session!"
    other_set_patch = other_client.patch(f"/api/v1/workouts/sets/{set_id}/", {'reps': 99})
    assert other_set_patch.status_code == 404, "Data isolation breach: other user updated workout set!"
    other_set_del = other_client.delete(f"/api/v1/workouts/sets/{set_id}/")
    assert other_set_del.status_code == 404, "Data isolation breach: other user deleted workout set!"
    print("✔ User data isolation confirmed: unauthorized user receives 404 on session & set access")

    # 10. Test Set Deletion
    del_set_res = client.delete(f"/api/v1/workouts/sets/{set_2_id}/")
    assert del_set_res.status_code == 200, f"Set deletion failed: {del_set_res.data}"
    assert not WorkoutSet.objects.filter(id=set_2_id).exists()
    print(f"✔ DELETE /api/v1/workouts/sets/{set_2_id}/ removed set successfully")

    # 11. Test Workout History API
    history_res = client.get('/api/v1/workouts/history/')
    assert history_res.status_code == 200, f"History query failed: {history_res.data}"
    hist_items = history_res.data.get('results', []) if isinstance(history_res.data, dict) else history_res.data
    assert len(hist_items) >= 1
    assert any(h['set_id'] == set_id for h in hist_items)
    print(f"✔ GET /api/v1/workouts/history/ returned {len(hist_items)} chronological log records")

    # 12. Test Workout Summary API
    summary_res = client.get('/api/v1/workouts/summary/')
    assert summary_res.status_code == 200, f"Summary failed: {summary_res.data}"
    summary = summary_res.data
    assert summary['total_sessions'] >= 1
    assert summary['total_sets'] >= 1
    assert summary['total_reps'] >= 15
    assert summary['total_weight_volume'] >= expected_updated_vol
    print(f"✔ GET /api/v1/workouts/summary/ returned metrics (sessions: {summary['total_sessions']}, sets: {summary['total_sets']}, volume: {summary['total_weight_volume']} kg)")

    print("=" * 70)
    print("ALL 12 WORKOUT INTEGRATION CHECKS PASSED PERFECTLY!")
    print("=" * 70)

if __name__ == '__main__':
    run_tests()
