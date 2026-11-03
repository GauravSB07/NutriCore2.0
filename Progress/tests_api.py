from datetime import date, timedelta
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from Progress.models import StepsLog
from Nutrition.models import Category, Food, MealLog, WaterIntake
from Workouts.models import MuscleGroup, SubMuscle, Exercise, WorkoutSession, WorkoutSet
from Users.models import Profile


class ProgressAPITests(APITestCase):
    def setUp(self):
        # Create Primary User
        self.user = User.objects.create_user(
            username='progress_tester',
            email='progress@example.com',
            password='TestPassword123!',
        )
        self.profile = self.user.profile
        self.profile.daily_calorie_target = 2000.0
        self.profile.daily_protein_target = 140.0
        self.profile.daily_steps_target = 8000
        self.profile.daily_water_goal = 3000.0
        self.profile.start_weight = 90.0
        self.profile.weight = 85.0
        self.profile.target_weight = 75.0
        self.profile.height = 180.0
        self.profile.goal = 'fat_loss'
        self.profile.save()

        self.token = str(RefreshToken.for_user(self.user).access_token)

        # Create Secondary User (for isolation testing)
        self.other_user = User.objects.create_user(
            username='other_progress_user',
            email='other_progress@example.com',
            password='OtherPassword123!',
        )
        self.other_profile = self.other_user.profile
        self.other_profile.start_weight = 70.0
        self.other_profile.weight = 70.0
        self.other_profile.target_weight = 80.0
        self.other_profile.save()

        self.other_token = str(RefreshToken.for_user(self.other_user).access_token)

        # Authenticate client with primary user by default
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    # --------------------------------------------------------------------------
    # 1. Daily Progress Tests
    # --------------------------------------------------------------------------

    def test_daily_progress_retrieval(self):
        """Daily progress endpoint aggregates calories, protein, steps, water, workouts and day_type."""
        today = date.today()

        # Create Category and Food
        cat = Category.objects.create(name='Protein Sources')
        food = Food.objects.create(name='Chicken Breast', calories_per_100g=165.0, protein_per_100g=31.0)
        food.categories.add(cat)
        MealLog.objects.create(user=self.user, food=food, quantity=200.0, calories=330.0, protein=62.0, date=today)
        WaterIntake.objects.create(user=self.user, amount=1500.0, date=today)
        StepsLog.objects.create(user=self.user, steps=4000, date=today)

        url = reverse('api_progress_daily')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['date'], str(today))
        self.assertEqual(response.data['nutrition']['total_calories'], 330.0)
        self.assertEqual(response.data['nutrition']['total_protein'], 62.0)
        self.assertEqual(response.data['nutrition']['calories_left'], 1670.0)
        self.assertEqual(response.data['nutrition']['day_type'], 'Good (Fat Loss)')
        self.assertTrue(response.data['nutrition']['good_day'])
        self.assertEqual(response.data['steps']['total_steps'], 4000)
        self.assertEqual(response.data['steps']['steps_left'], 4000)
        self.assertEqual(response.data['steps']['steps_percent'], 50.0)
        self.assertEqual(response.data['water']['total_water_ml'], 1500.0)
        self.assertEqual(response.data['water']['water_left_ml'], 1500.0)

    def test_daily_progress_date_filtering(self):
        """Daily progress can be filtered by ?date=YYYY-MM-DD."""
        past_date = date.today() - timedelta(days=5)
        StepsLog.objects.create(user=self.user, steps=6000, date=past_date)

        url = reverse('api_progress_daily')
        response = self.client.get(url, {'date': str(past_date)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['date'], str(past_date))
        self.assertEqual(response.data['steps']['total_steps'], 6000)

        # Invalid date format
        bad_response = self.client.get(url, {'date': 'invalid-date'})
        self.assertEqual(bad_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_daily_progress_create_steps(self):
        """User can log steps via POST /api/v1/progress/daily/."""
        url = reverse('api_progress_daily')
        payload = {'steps': 3500}
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['log']['steps'], 3500)
        self.assertEqual(response.data['daily_metrics']['steps']['total_steps'], 3500)
        self.assertTrue(StepsLog.objects.filter(user=self.user, steps=3500).exists())

    def test_daily_progress_detail_lifecycle(self):
        """User can retrieve, patch, and delete a daily progress step log by ID."""
        log = StepsLog.objects.create(user=self.user, steps=2000, date=date.today())
        detail_url = reverse('api_progress_daily_detail', kwargs={'id': log.id})

        # Retrieve
        get_resp = self.client.get(detail_url)
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(get_resp.data['steps'], 2000)

        # Patch
        patch_resp = self.client.patch(detail_url, {'steps': 2500}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['steps'], 2500)

        # Delete
        del_resp = self.client.delete(detail_url)
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(StepsLog.objects.filter(id=log.id).exists())

    # --------------------------------------------------------------------------
    # 2. Step Tracking Tests
    # --------------------------------------------------------------------------

    def test_step_tracking_list_create(self):
        """User can list step records with daily totals and add new step logs."""
        url = reverse('api_progress_steps')

        # Create step log
        post_resp = self.client.post(url, {'steps': 5000}, format='json')
        self.assertEqual(post_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(post_resp.data['steps'], 5000)

        # List step logs
        list_resp = self.client.get(url)
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertIn('daily_summary', list_resp.data)
        self.assertEqual(list_resp.data['daily_summary']['total_steps'], 5000)

    def test_step_tracking_detail_update_delete(self):
        """User can get, patch, and delete a step log."""
        log = StepsLog.objects.create(user=self.user, steps=3000, date=date.today())
        url = reverse('api_progress_steps_detail', kwargs={'id': log.id})

        # Get
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)

        # Patch
        patch_resp = self.client.patch(url, {'steps': 4000}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['steps'], 4000)

        # Delete
        del_resp = self.client.delete(url)
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(StepsLog.objects.filter(id=log.id).exists())

    def test_invalid_step_inputs(self):
        """Negative or zero steps must be rejected with 400 Bad Request."""
        url = reverse('api_progress_steps')
        bad_resp = self.client.post(url, {'steps': 0}, format='json')
        self.assertEqual(bad_resp.status_code, status.HTTP_400_BAD_REQUEST)

        bad_neg_resp = self.client.post(url, {'steps': -500}, format='json')
        self.assertEqual(bad_neg_resp.status_code, status.HTTP_400_BAD_REQUEST)

    # --------------------------------------------------------------------------
    # 3. Weight and Body Progress Tests
    # --------------------------------------------------------------------------

    def test_weight_progress_status_and_update(self):
        """User can retrieve weight progress, update weight, and reset weight."""
        url = reverse('api_progress_weight')

        # Retrieve initial weight status
        # start: 90, current: 85, target: 75 -> done: 5, total: 15 -> progress = 33.3%
        get_resp = self.client.get(url)
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(get_resp.data['current_weight'], 85.0)
        self.assertEqual(get_resp.data['start_weight'], 90.0)
        self.assertEqual(get_resp.data['target_weight'], 75.0)
        self.assertEqual(get_resp.data['weight_progress_percent'], 33.3)
        self.assertEqual(get_resp.data['weight_remaining'], 10.0)

        # Update weight to 82.5 kg -> done: 7.5, total: 15 -> progress = 50.0%
        post_resp = self.client.post(url, {'weight': 82.5}, format='json')
        self.assertEqual(post_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(post_resp.data['data']['current_weight'], 82.5)
        self.assertEqual(post_resp.data['data']['weight_progress_percent'], 50.0)
        self.assertEqual(post_resp.data['data']['weight_remaining'], 7.5)

        # Reset weight (DELETE)
        del_resp = self.client.delete(url)
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.assertIsNone(del_resp.data['data']['current_weight'])

    def test_invalid_weight_inputs(self):
        """Non-positive weights or missing fields must be rejected with 400 Bad Request."""
        url = reverse('api_progress_weight')

        # Zero weight
        resp_zero = self.client.post(url, {'weight': 0}, format='json')
        self.assertEqual(resp_zero.status_code, status.HTTP_400_BAD_REQUEST)

        # Negative weight
        resp_neg = self.client.post(url, {'weight': -80.0}, format='json')
        self.assertEqual(resp_neg.status_code, status.HTTP_400_BAD_REQUEST)

        # Empty body
        resp_empty = self.client.post(url, {}, format='json')
        self.assertEqual(resp_empty.status_code, status.HTTP_400_BAD_REQUEST)

    # --------------------------------------------------------------------------
    # 4. Weekly and Monthly Progress Reports
    # --------------------------------------------------------------------------

    def test_weekly_progress_report(self):
        """Weekly report aggregates 7-day data, labels, streak, calories, protein, and steps."""
        today = date.today()
        cat = Category.objects.create(name='Snacks')
        food = Food.objects.create(name='Oatmeal', calories_per_100g=400.0, protein_per_100g=20.0)
        food.categories.add(cat)

        # Log meals for the last 3 days to build a streak (2000 kcal >= 2000 target)
        for i in range(3):
            d = today - timedelta(days=i)
            MealLog.objects.create(user=self.user, food=food, quantity=500.0, date=d, is_cheat=False)
            StepsLog.objects.create(user=self.user, steps=7500, date=d)

        url = reverse('api_progress_weekly')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['labels']), 7)
        self.assertEqual(len(response.data['daily_breakdown']), 7)
        self.assertEqual(response.data['streak'], 3)
        self.assertGreaterEqual(response.data['totals']['total_steps'], 22500)
        self.assertIn('weight_status', response.data)

    def test_monthly_progress_report(self):
        """Monthly report provides 28-day 4-week summary and consistency days."""
        url = reverse('api_progress_monthly')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['weekly_summary']), 4)
        self.assertIn('consistency_days', response.data)
        self.assertIn('progress_percent', response.data)

    # --------------------------------------------------------------------------
    # 5. Workout Progress & Balance
    # --------------------------------------------------------------------------

    def test_workout_progress_analytics(self):
        """Workout progress calculates exercise progression, improvements, and muscle balance."""
        muscle = MuscleGroup.objects.create(name='Back Test')
        sub = SubMuscle.objects.create(name='Lats Test', muscle_group=muscle)
        ex = Exercise.objects.create(name='Lat Pulldown Test', sub_muscle=sub)

        # Log session 1 with 50kg
        d1 = date.today() - timedelta(days=3)
        session1 = WorkoutSession.objects.create(user=self.user, sub_muscle=sub)
        session1.date = d1
        session1.save()
        WorkoutSet.objects.create(session=session1, exercise=ex, sub_muscle=sub, set_number=1, reps=10, weight=50.0)

        # Log session 2 with 60kg (improved!)
        d2 = date.today()
        session2 = WorkoutSession.objects.create(user=self.user, sub_muscle=sub)
        session2.date = d2
        session2.save()
        WorkoutSet.objects.create(session=session2, exercise=ex, sub_muscle=sub, set_number=1, reps=10, weight=60.0)

        url = reverse('api_progress_workout')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Back Test', response.data['exercise_progress'])
        lats_ex = response.data['exercise_progress']['Back Test'][0]
        self.assertEqual(lats_ex['exercise'], 'Lat Pulldown Test')
        self.assertEqual(lats_ex['start_weight'], 50.0)
        self.assertEqual(lats_ex['latest_weight'], 60.0)
        self.assertTrue(lats_ex['improved'])

        self.assertIn('Back Test', response.data['muscle_balance'])
        self.assertEqual(response.data['muscle_balance']['Back Test']['balance_score'], 100)

    # --------------------------------------------------------------------------
    # 6. Progress History & Lifetime Summary
    # --------------------------------------------------------------------------

    def test_progress_history_and_summary(self):
        """History provides paginated date range metrics, summary provides lifetime dashboard."""
        StepsLog.objects.create(user=self.user, steps=8000, date=date.today())

        # History
        hist_url = reverse('api_progress_history')
        hist_resp = self.client.get(hist_url, {
            'start_date': str(date.today() - timedelta(days=6)),
            'end_date': str(date.today()),
        })
        self.assertEqual(hist_resp.status_code, status.HTTP_200_OK)
        self.assertIn('results', hist_resp.data)
        self.assertEqual(hist_resp.data['count'], 7)

        # Summary
        summary_url = reverse('api_progress_summary')
        sum_resp = self.client.get(summary_url)
        self.assertEqual(sum_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(sum_resp.data['user'], 'progress_tester')
        self.assertIn('profile', sum_resp.data)
        self.assertIn('nutrition_summary', sum_resp.data)
        self.assertIn('workout_summary', sum_resp.data)
        self.assertIn('steps_summary', sum_resp.data)
        self.assertIn('weight_summary', sum_resp.data)
        self.assertEqual(sum_resp.data['steps_summary']['total_steps'], 8000)

    def test_weekly_progress_optimized_calculation(self):
        """Verify WeeklyProgressView returns exact daily breakdown, totals, streaks, and progress percent."""
        today = date.today()
        cat = Category.objects.create(name='Weekly Test Cat')
        food = Food.objects.create(name='Weekly Test Food', calories_per_100g=100.0, protein_per_100g=10.0)
        food.categories.add(cat)

        # Day 0 (today): 2500 cals, 50g protein, not cheat
        MealLog.objects.create(user=self.user, food=food, quantity=2500.0, calories=2500.0, protein=50.0, date=today, is_cheat=False)
        StepsLog.objects.create(user=self.user, steps=10000, date=today)

        # Day -1 (yesterday): 1500 cals, 30g protein, is_cheat=True
        yesterday = today - timedelta(days=1)
        MealLog.objects.create(user=self.user, food=food, quantity=1500.0, calories=1500.0, protein=30.0, date=yesterday, is_cheat=True)
        StepsLog.objects.create(user=self.user, steps=5000, date=yesterday)

        # Day -2 (2 days ago): Workout session
        chest = MuscleGroup.objects.create(name='Weekly Chest')
        sub = SubMuscle.objects.create(name='Weekly Upper Chest', muscle_group=chest)
        two_days_ago = today - timedelta(days=2)
        ws = WorkoutSession.objects.create(user=self.user, sub_muscle=sub)
        WorkoutSession.objects.filter(pk=ws.pk).update(date=two_days_ago)

        url = reverse('api_progress_weekly')
        response = self.client.get(url, {'date': str(today)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(len(data['labels']), 7)
        self.assertEqual(len(data['daily_breakdown']), 7)

        # Check today (last item in breakdown, index 6)
        today_entry = data['daily_breakdown'][6]
        self.assertEqual(today_entry['date'], str(today))
        self.assertEqual(today_entry['calories'], 2500.0)
        self.assertEqual(today_entry['protein'], 250.0)
        self.assertFalse(today_entry['is_cheat_day'])
        self.assertEqual(today_entry['steps'], 10000)

        # Check yesterday (index 5)
        yesterday_entry = data['daily_breakdown'][5]
        self.assertEqual(yesterday_entry['date'], str(yesterday))
        self.assertEqual(yesterday_entry['calories'], 1500.0)
        self.assertEqual(yesterday_entry['protein'], 150.0)
        self.assertTrue(yesterday_entry['is_cheat_day'])
        self.assertEqual(yesterday_entry['steps'], 5000)

        # Check two days ago (index 4)
        two_days_ago_entry = data['daily_breakdown'][4]
        self.assertEqual(two_days_ago_entry['date'], str(two_days_ago))
        self.assertEqual(two_days_ago_entry['workout_sessions'], 1)

        # Empty day check (index 0, 6 days ago)
        empty_entry = data['daily_breakdown'][0]
        self.assertEqual(empty_entry['calories'], 0.0)
        self.assertEqual(empty_entry['protein'], 0.0)
        self.assertFalse(empty_entry['is_cheat_day'])
        self.assertEqual(empty_entry['steps'], 0)
        self.assertEqual(empty_entry['workout_sessions'], 0)

        # Totals check
        self.assertEqual(data['totals']['total_calories'], 4000.0)
        self.assertEqual(data['totals']['total_protein'], 400.0)
        self.assertEqual(data['totals']['total_steps'], 15000)
        self.assertEqual(data['totals']['total_workout_sessions'], 1)
        self.assertEqual(data['totals']['cheat_days_count'], 1)

        # Streak check: today met target (2500 >= 2000 and not cheat) -> streak 1
        self.assertEqual(data['streak'], 1)

    # --------------------------------------------------------------------------
    # 7. User Data Isolation Tests
    # --------------------------------------------------------------------------

    def test_user_data_isolation_progress(self):
        """User B must never view, modify, or delete User A's progress records."""
        log_a = StepsLog.objects.create(user=self.user, steps=10000, date=date.today())

        # Switch to User B
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.other_token}')

        # User B queries daily progress -> User A's steps are not counted
        daily_resp = self.client.get(reverse('api_progress_daily'))
        self.assertEqual(daily_resp.data['steps']['total_steps'], 0)

        # User B cannot view User A's log by ID
        log_url = reverse('api_progress_steps_detail', kwargs={'id': log_a.id})
        self.assertEqual(self.client.get(log_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.patch(log_url, {'steps': 20000}).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(log_url).status_code, status.HTTP_404_NOT_FOUND)

        # User B cannot access User A's daily detail
        daily_detail_url = reverse('api_progress_daily_detail', kwargs={'id': log_a.id})
        self.assertEqual(self.client.get(daily_detail_url).status_code, status.HTTP_404_NOT_FOUND)

        # User B weight progress reflects User B's profile, not User A's
        weight_resp = self.client.get(reverse('api_progress_weight'))
        self.assertEqual(weight_resp.data['current_weight'], 70.0)
        self.assertEqual(weight_resp.data['start_weight'], 70.0)

    def test_unauthenticated_access_rejected(self):
        """Protected progress endpoints must reject unauthenticated requests with 401."""
        self.client.credentials()  # Clear credentials

        self.assertEqual(self.client.get(reverse('api_progress_daily')).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post(reverse('api_progress_daily'), {}).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(reverse('api_progress_steps')).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(reverse('api_progress_weight')).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(reverse('api_progress_weekly')).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(reverse('api_progress_monthly')).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(reverse('api_progress_workout')).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(reverse('api_progress_history')).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(reverse('api_progress_summary')).status_code, status.HTTP_401_UNAUTHORIZED)

    # --------------------------------------------------------------------------
    # 8. Existing Django Progress Pages Verification
    # --------------------------------------------------------------------------

    def test_existing_progress_pages(self):
        """Verify that existing Django HTML page routes for progress remain fully operational."""
        # Unauthenticated -> redirect to login
        self.client.credentials()
        self.assertEqual(self.client.get(reverse('daily_report')).status_code, status.HTTP_302_FOUND)
        self.assertEqual(self.client.get(reverse('weekly_report')).status_code, status.HTTP_302_FOUND)
        self.assertEqual(self.client.get(reverse('monthly_report')).status_code, status.HTTP_302_FOUND)
        self.assertEqual(self.client.get(reverse('workout_progress')).status_code, status.HTTP_302_FOUND)
        self.assertEqual(self.client.get(reverse('workout_reports')).status_code, status.HTTP_302_FOUND)
        self.assertEqual(self.client.get(reverse('workout_charts')).status_code, status.HTTP_302_FOUND)
        self.assertEqual(self.client.get(reverse('log_steps')).status_code, status.HTTP_302_FOUND)

        # Authenticated -> 200 OK
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(reverse('daily_report')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('weekly_report')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('monthly_report')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('workout_progress')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('workout_reports')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('workout_charts')).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(reverse('log_steps')).status_code, status.HTTP_200_OK)
