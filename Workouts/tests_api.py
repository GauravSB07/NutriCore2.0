from datetime import date
from django.contrib.auth.models import User
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from Workouts.models import MuscleGroup, SubMuscle, Exercise, WorkoutSession, WorkoutSet


class WorkoutAPITests(APITestCase):
    def setUp(self):
        # Create test muscle groups
        self.chest = MuscleGroup.objects.create(name='Chest Test')
        self.legs = MuscleGroup.objects.create(name='Legs Test')

        # Create submuscles
        self.upper_chest = SubMuscle.objects.create(
            name='Upper Chest Test',
            muscle_group=self.chest,
            description='Target upper pectoral fibers',
        )
        self.quads = SubMuscle.objects.create(
            name='Quads Test',
            muscle_group=self.legs,
            description='Target quadriceps femoris',
        )

        # Create sample exercises
        self.incline_press = Exercise.objects.create(
            name='Incline Dumbbell Press Test',
            sub_muscle=self.upper_chest,
            equipment='Dumbbells, Incline Bench',
            description='Press dumbbells upward on 30-degree incline.',
            steps='Set bench to 30 degrees.\\nLie back with dumbbells.\\nPress upward smoothly.',
        )

        self.barbell_squat = Exercise.objects.create(
            name='Barbell Back Squat Test',
            sub_muscle=self.quads,
            equipment='Barbell, Squat Rack',
            description='Deep knee bend with barbell across upper traps.',
            steps='Position bar on traps.\\nSquat down to parallel.\\nDrive up through heels.',
        )

        # Create exercise with image
        small_gif = (
            b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00'
            b'\xff\xff\xff\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00'
            b'\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
        )
        self.pushup = Exercise.objects.create(
            name='Standard Pushup Test',
            sub_muscle=self.upper_chest,
            equipment='Bodyweight',
            image=SimpleUploadedFile('test_pushup.gif', small_gif, content_type='image/gif'),
        )

        # Create Primary User
        self.user = User.objects.create_user(
            username='workout_tester',
            email='workout@example.com',
            password='TestPassword123!',
        )
        self.token = str(RefreshToken.for_user(self.user).access_token)

        # Create Secondary User (for isolation testing)
        self.other_user = User.objects.create_user(
            username='other_workout_user',
            email='other_workout@example.com',
            password='OtherPassword123!',
        )
        self.other_token = str(RefreshToken.for_user(self.other_user).access_token)

        # Authenticate client with primary user by default
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def tearDown(self):
        if self.pushup.image:
            try:
                self.pushup.image.delete(save=False)
            except Exception:
                pass

    # --------------------------------------------------------------------------
    # 1. Workout Catalogue Tests (Public)
    # --------------------------------------------------------------------------

    def test_muscle_groups_list_public(self):
        """Muscle groups endpoint must be public and return list with submuscles count."""
        self.client.credentials()  # Unauthenticated
        url = reverse('api_workouts_muscles')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2)
        muscle_names = [m['name'] for m in response.data]
        self.assertIn('Chest Test', muscle_names)
        self.assertIn('Legs Test', muscle_names)

    def test_muscle_group_detail_public(self):
        """Muscle group detail must return muscle info and its submuscles."""
        self.client.credentials()
        url = reverse('api_workouts_muscle_detail', kwargs={'id': self.chest.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.chest.id)
        self.assertIn('sub_muscles', response.data)
        self.assertEqual(len(response.data['sub_muscles']), 1)
        self.assertEqual(response.data['sub_muscles'][0]['name'], 'Upper Chest Test')

    def test_submuscles_list_and_filter(self):
        """Submuscles endpoint must return list and support filtering by muscle group."""
        self.client.credentials()
        url = reverse('api_workouts_submuscles')

        # All submuscles
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2)

        # Filter by chest muscle group
        filtered_resp = self.client.get(url, {'muscle': self.chest.id})
        self.assertEqual(filtered_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(filtered_resp.data), 1)
        self.assertEqual(filtered_resp.data[0]['name'], 'Upper Chest Test')

    def test_exercise_catalogue_retrieval(self):
        """Exercise catalogue must be publicly accessible and return paginated exercises."""
        self.client.credentials()
        url = reverse('api_workouts_exercises')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertIn('count', response.data)
        self.assertGreaterEqual(response.data['count'], 3)

    def test_exercise_search(self):
        """Exercises must be searchable by name query."""
        self.client.credentials()
        url = reverse('api_workouts_exercises')
        response = self.client.get(url, {'search': 'Squat'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], 'Barbell Back Squat Test')

    def test_exercise_filtering_by_submuscle_and_muscle(self):
        """Exercises must be filterable by submuscle and muscle group."""
        self.client.credentials()
        url = reverse('api_workouts_exercises')

        # Filter by submuscle
        sub_resp = self.client.get(url, {'sub_muscle': self.quads.id})
        self.assertEqual(sub_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(sub_resp.data['count'], 1)
        self.assertEqual(sub_resp.data['results'][0]['name'], 'Barbell Back Squat Test')

        # Filter by muscle group
        muscle_resp = self.client.get(url, {'muscle': self.chest.id})
        self.assertEqual(muscle_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(muscle_resp.data['count'], 2)

    def test_exercise_detail(self):
        """Exercise detail must return full metadata and normalized steps."""
        self.client.credentials()
        url = reverse('api_workouts_exercise_detail', kwargs={'id': self.incline_press.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.incline_press.id)
        self.assertIn('\n', response.data['steps'])
        self.assertNotIn('\\n', response.data['steps'])

    def test_exercise_media_urls(self):
        """Exercise with image must return valid media URL."""
        self.client.credentials()
        url = reverse('api_workouts_exercise_detail', kwargs={'id': self.pushup.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data['image_url'])
        self.assertTrue(len(response.data['image_url']) > 0)

    # --------------------------------------------------------------------------
    # 2. Workout Session Tests (Authenticated)
    # --------------------------------------------------------------------------

    def test_workout_session_lifecycle(self):
        """User can create, retrieve, update, and delete workout sessions."""
        url = reverse('api_workouts_sessions')

        # Create session
        create_resp = self.client.post(url, {'sub_muscle_id': self.upper_chest.id}, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        session_id = create_resp.data['id']
        self.assertEqual(create_resp.data['sub_muscle']['id'], self.upper_chest.id)

        # Retrieve session detail
        detail_url = reverse('api_workouts_session_detail', kwargs={'id': session_id})
        detail_resp = self.client.get(detail_url)
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_resp.data['id'], session_id)

        # Update session submuscle
        patch_resp = self.client.patch(detail_url, {'sub_muscle_id': self.quads.id}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['sub_muscle']['id'], self.quads.id)

        # Delete session
        del_resp = self.client.delete(detail_url)
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(WorkoutSession.objects.filter(id=session_id).exists())

    # --------------------------------------------------------------------------
    # 3. Workout Set Tests
    # --------------------------------------------------------------------------

    def test_workout_set_lifecycle(self):
        """User can log sets, auto-increment set numbers, calculate volume, update, and delete sets."""
        session = WorkoutSession.objects.create(user=self.user, sub_muscle=self.upper_chest)

        sets_url = reverse('api_workouts_session_sets', kwargs={'id': session.id})

        # Log Set 1: 10 reps @ 60kg -> Volume: 600.0
        set1_resp = self.client.post(sets_url, {
            'exercise_id': self.incline_press.id,
            'reps': 10,
            'weight': 60.0,
        }, format='json')
        self.assertEqual(set1_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(set1_resp.data['set_number'], 1)
        self.assertEqual(set1_resp.data['volume'], 600.0)

        set1_id = set1_resp.data['id']

        # Log Set 2: 8 reps @ 65kg -> Volume: 520.0
        set2_resp = self.client.post(sets_url, {
            'exercise_id': self.incline_press.id,
            'reps': 8,
            'weight': 65.0,
        }, format='json')
        self.assertEqual(set2_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(set2_resp.data['set_number'], 2)
        self.assertEqual(set2_resp.data['volume'], 520.0)

        # Retrieve sets in session
        get_sets_resp = self.client.get(sets_url)
        self.assertEqual(get_sets_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(get_sets_resp.data), 2)

        # Update Set 1 weight to 62.5kg -> Volume: 625.0
        set_detail_url = reverse('api_workouts_set_detail', kwargs={'id': set1_id})
        patch_resp = self.client.patch(set_detail_url, {'weight': 62.5}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['volume'], 625.0)

        # Delete Set 1
        del_resp = self.client.delete(set_detail_url)
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(WorkoutSet.objects.filter(id=set1_id).exists())

    def test_invalid_workout_set_inputs(self):
        """Invalid exercise IDs, negative reps, or negative weight must return 400 Bad Request."""
        session = WorkoutSession.objects.create(user=self.user, sub_muscle=self.upper_chest)
        sets_url = reverse('api_workouts_session_sets', kwargs={'id': session.id})

        # Nonexistent exercise ID
        bad_ex_resp = self.client.post(sets_url, {'exercise_id': 99999, 'reps': 10, 'weight': 50.0}, format='json')
        self.assertEqual(bad_ex_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # Invalid reps (< 1)
        bad_reps_resp = self.client.post(sets_url, {'exercise_id': self.incline_press.id, 'reps': 0, 'weight': 50.0}, format='json')
        self.assertEqual(bad_reps_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # Invalid weight (< 0)
        bad_weight_resp = self.client.post(sets_url, {'exercise_id': self.incline_press.id, 'reps': 10, 'weight': -10.0}, format='json')
        self.assertEqual(bad_weight_resp.status_code, status.HTTP_400_BAD_REQUEST)

    # --------------------------------------------------------------------------
    # 4. User Data Isolation Tests
    # --------------------------------------------------------------------------

    def test_user_data_isolation_workouts(self):
        """User B must never access, modify, or add sets to User A's workout sessions."""
        session_a = WorkoutSession.objects.create(user=self.user, sub_muscle=self.upper_chest)
        set_a = WorkoutSet.objects.create(
            session=session_a,
            exercise=self.incline_press,
            sub_muscle=self.upper_chest,
            set_number=1,
            reps=10,
            weight=50.0,
        )

        # Switch to User B
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.other_token}')

        # User B queries sessions list -> User A's session not present
        sessions_resp = self.client.get(reverse('api_workouts_sessions'))
        session_ids = [s['id'] for s in sessions_resp.data['results']]
        self.assertNotIn(session_a.id, session_ids)

        # User B cannot access User A's session detail
        session_url = reverse('api_workouts_session_detail', kwargs={'id': session_a.id})
        self.assertEqual(self.client.get(session_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.patch(session_url, {'sub_muscle_id': self.quads.id}).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(session_url).status_code, status.HTTP_404_NOT_FOUND)

        # User B cannot view or log sets in User A's session
        sets_url = reverse('api_workouts_session_sets', kwargs={'id': session_a.id})
        self.assertEqual(self.client.get(sets_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.post(sets_url, {'exercise_id': self.incline_press.id, 'reps': 10, 'weight': 50}).status_code, status.HTTP_404_NOT_FOUND)

        # User B cannot patch or delete User A's set
        set_url = reverse('api_workouts_set_detail', kwargs={'id': set_a.id})
        self.assertEqual(self.client.patch(set_url, {'weight': 100}).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(set_url).status_code, status.HTTP_404_NOT_FOUND)

    def test_unauthenticated_access_rejected(self):
        """Protected workout endpoints must reject unauthenticated requests with 401."""
        self.client.credentials()  # Clear credentials

        self.assertEqual(self.client.get(reverse('api_workouts_sessions')).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post(reverse('api_workouts_sessions'), {}).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(reverse('api_workouts_history')).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.get(reverse('api_workouts_summary')).status_code, status.HTTP_401_UNAUTHORIZED)

    # --------------------------------------------------------------------------
    # 5. Workout History and Summary Tests
    # --------------------------------------------------------------------------

    def test_workout_history_and_summary(self):
        """History and summary endpoints must aggregate sets, reps, volume, and muscle groups."""
        session = WorkoutSession.objects.create(user=self.user, sub_muscle=self.upper_chest)
        WorkoutSet.objects.create(session=session, exercise=self.incline_press, sub_muscle=self.upper_chest, set_number=1, reps=10, weight=60.0)
        WorkoutSet.objects.create(session=session, exercise=self.incline_press, sub_muscle=self.upper_chest, set_number=2, reps=8, weight=70.0)

        # History test
        hist_url = reverse('api_workouts_history')
        hist_resp = self.client.get(hist_url)
        self.assertEqual(hist_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(hist_resp.data['count'], 2)
        self.assertEqual(hist_resp.data['results'][0]['volume'], 600.0)

        # Summary test
        summary_url = reverse('api_workouts_summary')
        sum_resp = self.client.get(summary_url)
        self.assertEqual(sum_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(sum_resp.data['total_sessions'], 1)
        self.assertEqual(sum_resp.data['total_sets'], 2)
        self.assertEqual(sum_resp.data['total_reps'], 18)
        self.assertEqual(sum_resp.data['total_weight_volume'], 1160.0)
        self.assertEqual(sum_resp.data['distinct_exercises_count'], 1)
        self.assertGreaterEqual(len(sum_resp.data['muscle_groups_breakdown']), 1)

    def test_muscle_groups_sub_muscles_count_annotation(self):
        """Verify MuscleGroup list returns correct sub_muscles_count."""
        url = reverse('api_workouts_muscles')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = {m['name']: m['sub_muscles_count'] for m in response.data}
        self.assertEqual(data.get('Chest Test'), 1)
        self.assertEqual(data.get('Legs Test'), 1)

    def test_sub_muscles_exercises_count_annotation(self):
        """Verify SubMuscle list returns correct exercises_count."""
        url = reverse('api_workouts_submuscles')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = {s['name']: s['exercises_count'] for s in response.data}
        self.assertEqual(data.get('Upper Chest Test'), 2)
        self.assertEqual(data.get('Quads Test'), 1)

    def test_exercise_list_sub_muscle_lean_response(self):
        """Verify Exercise list includes sub_muscle details with backward compatibility."""
        url = reverse('api_workouts_exercises')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        first = response.data['results'][0]
        self.assertIn('sub_muscle', first)
        self.assertIn('id', first['sub_muscle'])
        self.assertIn('name', first['sub_muscle'])
        self.assertIn('muscle_group_name', first)

    # --------------------------------------------------------------------------
    # 6. Existing Django Workout Pages Verification
    # --------------------------------------------------------------------------

    def test_existing_workout_pages(self):
        """Verify that existing Django HTML page routes for workouts remain fully operational."""
        # Public catalogue pages
        self.client.credentials()  # Unauthenticated
        resp_lib = self.client.get(reverse('workout_library'))
        self.assertEqual(resp_lib.status_code, status.HTTP_200_OK)

        resp_sub = self.client.get(reverse('sub_muscle_list', kwargs={'muscle_id': self.chest.id}))
        self.assertEqual(resp_sub.status_code, status.HTTP_200_OK)

        resp_ex_list = self.client.get(reverse('exercise_list', kwargs={'sub_id': self.upper_chest.id}))
        self.assertEqual(resp_ex_list.status_code, status.HTTP_200_OK)

        resp_ex_det = self.client.get(reverse('exercise_detail', kwargs={'id': self.incline_press.id}))
        self.assertEqual(resp_ex_det.status_code, status.HTTP_200_OK)

        # Unauthenticated protected start route -> redirect to login
        resp_start_unauth = self.client.get(reverse('start_workout'))
        self.assertEqual(resp_start_unauth.status_code, status.HTTP_302_FOUND)

        # Authenticated session start route -> 200 OK
        self.client.force_login(self.user)
        resp_start_auth = self.client.get(reverse('start_workout'))
        self.assertEqual(resp_start_auth.status_code, status.HTTP_200_OK)
