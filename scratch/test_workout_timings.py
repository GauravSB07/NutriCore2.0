import os
import sys
import time
import django

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NutriCore.settings')
django.setup()

from django.db import connection, reset_queries
from django.test.utils import CaptureQueriesContext
from django.contrib.auth.models import User
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from Users.api.views import CookieTokenRefreshView, MeView
from Workouts.api.views import MuscleGroupDetailView, SubMuscleListView

def profile_endpoint(name, view_func, path, method="GET", user=None, data=None):
    # Force a close of old connection to simulate CONN_MAX_AGE = 0
    connection.close()
    
    factory = APIRequestFactory()
    t_start = time.perf_counter()
    if method == "POST":
        req = factory.post(path, data or {}, format='json')
    else:
        req = factory.get(path, data or {})
    
    if user:
        force_authenticate(req, user=user)
        
    t_req_ready = time.perf_counter()
    
    reset_queries()
    with CaptureQueriesContext(connection) as queries_ctx:
        # Time when connection is opened
        t_before_view = time.perf_counter()
        resp = view_func(req, **(data.get('kwargs', {}) if data and 'kwargs' in data else {}))
        t_after_view = time.perf_counter()
        
    total_time = (t_after_view - t_start) * 1000
    view_time = (t_after_view - t_before_view) * 1000
    db_time = sum(float(q.get('time', 0)) for q in queries_ctx) * 1000
    conn_and_overhead = view_time - db_time
    
    print(f"\n[{name}]")
    print(f"  Status: {resp.status_code}")
    print(f"  Total Wall Time: {total_time:.2f} ms")
    print(f"  DB Query Time:   {db_time:.2f} ms across {len(queries_ctx)} queries")
    print(f"  Conn + Overhead: {conn_and_overhead:.2f} ms")
    for i, q in enumerate(queries_ctx, 1):
        print(f"    Q{i} ({float(q['time'])*1000:.1f}ms): {q['sql'][:120]}...")

def run():
    user = User.objects.first()
    print(f"User: {user.username} (ID: {user.id})")
    
    # Generate fresh refresh token
    refresh = RefreshToken.for_user(user)
    
    # 1. Token Refresh
    profile_endpoint("POST /api/v1/auth/token/refresh/", CookieTokenRefreshView.as_view(), "/api/v1/auth/token/refresh/", method="POST", data={'refresh': str(refresh)})
    
    # 2. Me
    profile_endpoint("GET /api/v1/auth/me/", MeView.as_view(), "/api/v1/auth/me/", user=user)
    
    # 3. Muscle 36 detail
    profile_endpoint("GET /api/v1/workouts/muscles/36/", MuscleGroupDetailView.as_view(), "/api/v1/workouts/muscles/36/", user=user, data={'kwargs': {'id': 36}})
    
    # 4. Submuscles for muscle 36
    profile_endpoint("GET /api/v1/workouts/submuscles/?muscle=36", SubMuscleListView.as_view(), "/api/v1/workouts/submuscles/?muscle=36", user=user, data={'muscle': '36'})

if __name__ == '__main__':
    run()

