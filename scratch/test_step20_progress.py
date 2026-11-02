import os
import sys

# Configure encoding for Windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.path.insert(0, os.path.abspath('.'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'NutriCore.settings'

import django
django.setup()

from django.conf import settings
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

from django.contrib.auth.models import User
from rest_framework.test import APIClient
from datetime import date, timedelta
from Progress.models import StepsLog

def run_tests():
    print("==================================================")
    print("STEP 20: PROGRESS MODULE INTEGRATION VERIFICATION")
    print("==================================================")

    client = APIClient()

    # 1. Setup test user
    username = "test_progress_user"
    user, created = User.objects.get_or_create(username=username, defaults={'email': 'progress@example.com'})
    user.set_password("ProgressPass123!")
    user.save()

    if hasattr(user, 'profile'):
        profile = user.profile
        profile.daily_calorie_target = 2000
        profile.daily_protein_target = 120
        profile.daily_steps_target = 10000
        profile.weight = 75.0
        profile.start_weight = 82.0
        profile.target_weight = 70.0
        profile.height = 178.0
        profile.goal = 'cut'
        profile.save()

    client.force_authenticate(user=user)

    tests_passed = 0
    total_tests = 0

    def assert_test(cond, title):
        nonlocal tests_passed, total_tests
        total_tests += 1
        if cond:
            print(f" [PASS] Test {total_tests}: {title}")
            tests_passed += 1
        else:
            print(f" [FAIL] Test {total_tests}: {title}")

    # TEST 1: GET /api/v1/progress/daily/
    res = client.get('/api/v1/progress/daily/')
    assert_test(res.status_code == 200 and 'nutrition' in res.data and 'steps' in res.data, "GET /api/v1/progress/daily/ returns 200 and daily metrics")

    # TEST 2: POST /api/v1/progress/steps/
    res = client.post('/api/v1/progress/steps/', {'steps': 1500, 'date': str(date.today())}, format='json')
    assert_test(res.status_code == 201 and res.data['steps'] == 1500, "POST /api/v1/progress/steps/ logs steps")
    step_id = res.data.get('id')

    # TEST 3: GET /api/v1/progress/steps/{id}/
    res = client.get(f'/api/v1/progress/steps/{step_id}/')
    assert_test(res.status_code == 200 and res.data['steps'] == 1500, f"GET /api/v1/progress/steps/{step_id}/ retrieves logged step record")

    # TEST 4: PATCH /api/v1/progress/steps/{id}/
    res = client.patch(f'/api/v1/progress/steps/{step_id}/', {'steps': 2000}, format='json')
    assert_test(res.status_code == 200 and res.data['steps'] == 2000, f"PATCH /api/v1/progress/steps/{step_id}/ updates step count")

    # TEST 5: GET /api/v1/progress/steps/ list
    res = client.get('/api/v1/progress/steps/')
    assert_test(res.status_code == 200 and ('results' in res.data or isinstance(res.data, list)), "GET /api/v1/progress/steps/ returns history and summary")

    # TEST 6: DELETE /api/v1/progress/steps/{id}/
    res = client.delete(f'/api/v1/progress/steps/{step_id}/')
    assert_test(res.status_code == 200, f"DELETE /api/v1/progress/steps/{step_id}/ deletes step record")

    # TEST 7: GET /api/v1/progress/weight/
    res = client.get('/api/v1/progress/weight/')
    assert_test(res.status_code == 200 and 'current_weight' in res.data and 'weight_progress_percent' in res.data, "GET /api/v1/progress/weight/ returns weight metrics")

    # TEST 8: PATCH /api/v1/progress/weight/
    res = client.patch('/api/v1/progress/weight/', {'weight': 74.5, 'target_weight': 69.0}, format='json')
    assert_test(res.status_code == 200 and res.data['data']['current_weight'] == 74.5, "PATCH /api/v1/progress/weight/ updates weight status")

    # TEST 9: GET /api/v1/progress/weekly/
    res = client.get('/api/v1/progress/weekly/')
    assert_test(res.status_code == 200 and 'labels' in res.data and 'progress_percent' in res.data and 'streak' in res.data, "GET /api/v1/progress/weekly/ returns 7-day breakdown and streak")

    # TEST 10: GET /api/v1/progress/monthly/
    res = client.get('/api/v1/progress/monthly/')
    assert_test(res.status_code == 200 and 'weekly_summary' in res.data and 'consistency_days' in res.data, "GET /api/v1/progress/monthly/ returns 4-week summary")

    # TEST 11: GET /api/v1/progress/workout/
    res = client.get('/api/v1/progress/workout/')
    assert_test(res.status_code == 200 and 'exercise_progress' in res.data and 'weekly_muscle_report' in res.data and 'muscle_balance' in res.data, "GET /api/v1/progress/workout/ returns overload and balance reports")

    # TEST 12: GET /api/v1/progress/history/
    res = client.get('/api/v1/progress/history/')
    assert_test(res.status_code == 200, "GET /api/v1/progress/history/ returns history records")

    # TEST 13: GET /api/v1/progress/summary/
    res = client.get('/api/v1/progress/summary/')
    assert_test(res.status_code == 200 and 'nutrition_summary' in res.data and 'workout_summary' in res.data, "GET /api/v1/progress/summary/ returns lifetime stats")

    # TEST 14: React Page Files Verification
    pages = [
        "frontend/src/pages/progress/ProgressDashboardPage.jsx",
        "frontend/src/pages/progress/DailyReportPage.jsx",
        "frontend/src/pages/progress/LogStepsPage.jsx",
        "frontend/src/pages/progress/WeeklyReportPage.jsx",
        "frontend/src/pages/progress/MonthlyReportPage.jsx",
        "frontend/src/pages/progress/WorkoutProgressPage.jsx",
        "frontend/src/pages/progress/WorkoutReportsPage.jsx",
        "frontend/src/pages/progress/WorkoutChartsPage.jsx",
        "frontend/src/pages/progress/WeightTrackingPage.jsx",
        "frontend/src/components/progress/chartConfig.js",
    ]
    all_pages_exist = all(os.path.exists(p) for p in pages)
    assert_test(all_pages_exist, f"All {len(pages)} Progress React pages and components exist")

    # TEST 15: App.jsx Route Registration
    with open('frontend/src/App.jsx', 'r', encoding='utf-8') as f:
        app_code = f.read()
    routes_registered = (
        'progress' in app_code and
        'progress/daily' in app_code and
        'progress/steps' in app_code and
        'progress/weekly' in app_code and
        'progress/monthly' in app_code and
        'progress/workout' in app_code and
        'progress/muscle-reports' in app_code and
        'progress/workout-charts' in app_code and
        'progress/weight' in app_code
    )
    assert_test(routes_registered, "All Progress routes registered in App.jsx")

    print("--------------------------------------------------")
    print(f"RESULTS: {tests_passed}/{total_tests} tests passed.")
    print("==================================================")

    if tests_passed == total_tests:
        print("ALL PROGRESS INTEGRATION TESTS COMPLETED SUCCESSFULLY!")
        return 0
    else:
        print("SOME TESTS FAILED.")
        return 1

if __name__ == '__main__':
    sys.exit(run_tests())
