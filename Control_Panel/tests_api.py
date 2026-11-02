import io
from PIL import Image
from datetime import date
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from Users.models import Profile
from Nutrition.models import Category, Food, MealLog
from Workouts.models import MuscleGroup, SubMuscle, Exercise
from Recipes.models import Recipe, RecipeCategory


def generate_test_image(name='test.jpg'):
    file = io.BytesIO()
    image = Image.new('RGB', (100, 100), color='blue')
    image.save(file, 'jpeg')
    file.seek(0)
    return SimpleUploadedFile(name, file.read(), content_type='image/jpeg')


class ControlPanelAdminAPITests(APITestCase):
    def setUp(self):
        # 1. Superuser
        self.superuser = User.objects.create_superuser(
            username='admin_boss',
            email='admin@nutricore.com',
            password='AdminPassword123!',
        )
        self.superuser_token = str(RefreshToken.for_user(self.superuser).access_token)

        # 2. Staff user (NOT superuser)
        self.staff_user = User.objects.create_user(
            username='staff_member',
            email='staff@nutricore.com',
            password='StaffPassword123!',
            is_staff=True,
            is_superuser=False,
        )
        self.staff_token = str(RefreshToken.for_user(self.staff_user).access_token)

        # 3. Regular user (NOT staff, NOT superuser)
        self.regular_user = User.objects.create_user(
            username='regular_joe',
            email='joe@example.com',
            password='UserPassword123!',
        )
        self.regular_token = str(RefreshToken.for_user(self.regular_user).access_token)

        # Profiles
        self.super_profile, _ = Profile.objects.get_or_create(user=self.superuser)
        self.regular_profile, _ = Profile.objects.get_or_create(user=self.regular_user)

        # Baseline catalogue items
        self.food_cat = Category.objects.create(name='Fruits Test')
        self.food_apple = Food.objects.create(
            name='Fresh Red Apple Test',
            calories_per_100g=52.0,
            protein_per_100g=0.3,
            unit_type='g',
        )
        self.food_apple.categories.add(self.food_cat)

        self.recipe_cat = RecipeCategory.objects.create(name='Snacks Test')
        self.recipe = Recipe.objects.create(
            name='Apple Slices Test',
            category=self.recipe_cat,
            calories=52.0,
            protein=0.3,
            price=2.5,
            ingredients='1 Apple',
            method='Slice and serve.',
        )

        self.muscle = MuscleGroup.objects.create(name='Chest Test')
        self.submuscle = SubMuscle.objects.create(
            name='Upper Chest Test',
            muscle_group=self.muscle,
        )
        self.exercise = Exercise.objects.create(
            name='Incline Dumbbell Press Test',
            sub_muscle=self.submuscle,
            equipment='Dumbbells',
            description='Target upper pectoral fibers',
            steps='Lie on incline bench\nPress dumbbells up',
        )

        self.meal_log = MealLog.objects.create(
            user=self.regular_user,
            food=self.food_apple,
            quantity=150.0,
            unit='g',
            date=date.today(),
            calories=78.0,
            protein=0.45,
        )

    # ==========================================================================
    # A. ADMIN DASHBOARD TESTS
    # ==========================================================================

    def test_dashboard_superuser_success(self):
        url = '/api/v1/admin/dashboard/'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn('users', data)
        self.assertIn('profiles', data)
        self.assertIn('foods', data)
        self.assertIn('food_categories', data)
        self.assertIn('recipes', data)
        self.assertIn('recipe_categories', data)
        self.assertIn('exercises', data)
        self.assertIn('muscle_groups', data)
        self.assertIn('submuscles', data)
        self.assertIn('meals_logged_today', data)

        # Verify accurate database counts
        self.assertEqual(data['users'], User.objects.count())
        self.assertEqual(data['profiles'], Profile.objects.count())
        self.assertEqual(data['foods'], Food.objects.count())
        self.assertEqual(data['food_categories'], Category.objects.count())
        self.assertEqual(data['recipes'], Recipe.objects.count())
        self.assertEqual(data['recipe_categories'], RecipeCategory.objects.count())
        self.assertEqual(data['exercises'], Exercise.objects.count())
        self.assertEqual(data['muscle_groups'], MuscleGroup.objects.count())
        self.assertEqual(data['submuscles'], SubMuscle.objects.count())
        self.assertEqual(data['meals_logged_today'], 1)

    def test_dashboard_unauthenticated_denied(self):
        url = '/api/v1/admin/dashboard/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dashboard_ordinary_user_denied(self):
        url = '/api/v1/admin/dashboard/'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.regular_token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dashboard_staff_user_denied(self):
        # Ordinary staff user is NOT superuser -> MUST be 403 Forbidden
        url = '/api/v1/admin/dashboard/'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.staff_token}')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # ==========================================================================
    # B. ADMIN USER MANAGEMENT TESTS
    # ==========================================================================

    def test_users_list_and_search_superuser(self):
        url = '/api/v1/admin/users/'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')

        # List all
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertGreaterEqual(response.data['count'], 3)

        # Ensure password is NOT in response
        first_user = response.data['results'][0]
        self.assertNotIn('password', first_user)

        # Search query
        response_search = self.client.get(f'{url}?search=regular_joe')
        self.assertEqual(response_search.status_code, status.HTTP_200_OK)
        self.assertEqual(response_search.data['count'], 1)
        self.assertEqual(response_search.data['results'][0]['username'], 'regular_joe')

    def test_user_create_superuser(self):
        url = '/api/v1/admin/users/'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')
        payload = {
            'username': 'new_trainee',
            'email': 'new_trainee@example.com',
            'password': 'SecurePassword999!',
            'is_staff': False,
            'is_superuser': False,
        }
        response = self.client.post(url, data=payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('password', response.data)
        self.assertEqual(response.data['username'], 'new_trainee')

        # Verify DB creation and PBKDF2 hashing
        created = User.objects.get(username='new_trainee')
        self.assertTrue(created.check_password('SecurePassword999!'))
        self.assertTrue(Profile.objects.filter(user=created).exists())

    def test_user_detail_and_patch_superuser(self):
        url = f'/api/v1/admin/users/{self.regular_user.id}/'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')

        # GET detail
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'regular_joe')
        self.assertNotIn('password', response.data)

        # PATCH update
        patch_payload = {'email': 'updated_joe@example.com', 'is_staff': True}
        response_patch = self.client.patch(url, data=patch_payload)
        self.assertEqual(response_patch.status_code, status.HTTP_200_OK)
        self.regular_user.refresh_from_db()
        self.assertEqual(self.regular_user.email, 'updated_joe@example.com')
        self.assertTrue(self.regular_user.is_staff)

    def test_user_delete_protection_and_success(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')

        # 1. Attempt self-deletion -> HTTP 400
        self_url = f'/api/v1/admin/users/{self.superuser.id}/'
        res_self = self.client.delete(self_url)
        self.assertEqual(res_self.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot delete your own', res_self.data['detail'])

        # 2. Successfully delete another user
        target = User.objects.create_user(username='to_be_deleted', password='PassWord123!')
        target_url = f'/api/v1/admin/users/{target.id}/'
        res_del = self.client.delete(target_url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertFalse(User.objects.filter(username='to_be_deleted').exists())

    # ==========================================================================
    # C. ADMIN PROFILE MANAGEMENT TESTS
    # ==========================================================================

    def test_profiles_list_and_search_superuser(self):
        url = '/api/v1/admin/profiles/'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)

        # Search by username
        response_search = self.client.get(f'{url}?search=regular_joe')
        self.assertEqual(response_search.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response_search.data['count'], 1)

    def test_profile_detail_and_patch_superuser(self):
        url = f'/api/v1/admin/profiles/{self.regular_profile.id}/'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')

        # GET
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user']['username'], 'regular_joe')

        # PATCH
        patch_payload = {
            'daily_calorie_target': 2400.0,
            'daily_protein_target': 160.0,
            'points': 500,
            'goal': 'muscle_gain',
        }
        response_patch = self.client.patch(url, data=patch_payload)
        self.assertEqual(response_patch.status_code, status.HTTP_200_OK)
        self.regular_profile.refresh_from_db()
        self.assertEqual(self.regular_profile.daily_calorie_target, 2400.0)
        self.assertEqual(self.regular_profile.points, 500)
        self.assertEqual(self.regular_profile.goal, 'muscle_gain')

    # ==========================================================================
    # D. FOOD MANAGEMENT TESTS
    # ==========================================================================

    def test_food_create_superuser_success(self):
        url = '/api/v1/nutrition/foods/'
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')

        image_file = generate_test_image('banana.jpg')
        payload = {
            'name': 'Golden Banana Test',
            'calories_per_100g': 89.0,
            'protein_per_100g': 1.1,
            'unit_type': 'g',
            'categories': [self.food_cat.id],
            'image': image_file,
        }
        response = self.client.post(url, data=payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Golden Banana Test')
        self.assertEqual(len(response.data['categories']), 1)

        food = Food.objects.get(name='Golden Banana Test')
        self.assertEqual(food.categories.first().id, self.food_cat.id)
        self.assertTrue(food.image)

    def test_food_create_non_superuser_denied(self):
        url = '/api/v1/nutrition/foods/'
        payload = {'name': 'Hacker Food', 'calories_per_100g': 100.0}

        # Unauthenticated
        res_anon = self.client.post(url, data=payload)
        self.assertEqual(res_anon.status_code, status.HTTP_401_UNAUTHORIZED)

        # Staff non-superuser
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.staff_token}')
        res_staff = self.client.post(url, data=payload)
        self.assertEqual(res_staff.status_code, status.HTTP_403_FORBIDDEN)

        # Regular user
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.regular_token}')
        res_reg = self.client.post(url, data=payload)
        self.assertEqual(res_reg.status_code, status.HTTP_403_FORBIDDEN)

    def test_food_patch_and_delete_superuser(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')
        food = Food.objects.create(
            name='Temporary Food',
            calories_per_100g=100.0,
            protein_per_100g=2.0,
            unit_type='g',
        )
        url = f'/api/v1/nutrition/foods/{food.id}/'

        # PATCH
        res_patch = self.client.patch(url, data={'calories_per_100g': 120.0})
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        food.refresh_from_db()
        self.assertEqual(food.calories_per_100g, 120.0)

        # DELETE
        res_del = self.client.delete(url)
        self.assertIn(res_del.status_code, [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT])
        self.assertFalse(Food.objects.filter(id=food.id).exists())

    # ==========================================================================
    # E. FOOD CATEGORY MANAGEMENT TESTS
    # ==========================================================================

    def test_category_crud_superuser(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')

        # 1. POST
        res_create = self.client.post('/api/v1/nutrition/categories/', data={'name': 'Organic Veggies Test'})
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        cat_id = res_create.data['id']

        # 2. PATCH
        res_patch = self.client.patch(f'/api/v1/nutrition/categories/{cat_id}/', data={'name': 'Fresh Organic Veggies'})
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data['name'], 'Fresh Organic Veggies')

        # 3. DELETE
        res_del = self.client.delete(f'/api/v1/nutrition/categories/{cat_id}/')
        self.assertIn(res_del.status_code, [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT])
        self.assertFalse(Category.objects.filter(id=cat_id).exists())

    # ==========================================================================
    # F. WORKOUT CATALOGUE MANAGEMENT TESTS (EXERCISE, MUSCLE, SUBMUSCLE)
    # ==========================================================================

    def test_muscle_group_crud_superuser(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')

        # POST
        res_post = self.client.post('/api/v1/workouts/muscles/', data={'name': 'Shoulders Test'})
        self.assertEqual(res_post.status_code, status.HTTP_201_CREATED)
        muscle_id = res_post.data['id']

        # PATCH
        res_patch = self.client.patch(f'/api/v1/workouts/muscles/{muscle_id}/', data={'name': 'Deltoids Test'})
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)

        # DELETE
        res_del = self.client.delete(f'/api/v1/workouts/muscles/{muscle_id}/')
        self.assertIn(res_del.status_code, [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT])
        self.assertFalse(MuscleGroup.objects.filter(id=muscle_id).exists())

    def test_submuscle_crud_superuser(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')

        # POST
        res_post = self.client.post('/api/v1/workouts/submuscles/', data={
            'name': 'Lower Chest Test',
            'muscle_group_id': self.muscle.id,
            'description': 'Lower sternal pectoralis',
        })
        self.assertEqual(res_post.status_code, status.HTTP_201_CREATED)
        sub_id = res_post.data['id']

        # PATCH
        res_patch = self.client.patch(f'/api/v1/workouts/submuscles/{sub_id}/', data={
            'name': 'Lower Pecs Updated',
        })
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)

        # DELETE
        res_del = self.client.delete(f'/api/v1/workouts/submuscles/{sub_id}/')
        self.assertIn(res_del.status_code, [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT])
        self.assertFalse(SubMuscle.objects.filter(id=sub_id).exists())

    def test_exercise_crud_superuser(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')

        # POST
        res_post = self.client.post('/api/v1/workouts/exercises/', data={
            'name': 'Cable Flyes Test',
            'sub_muscle_id': self.submuscle.id,
            'equipment': 'Cable Machine',
            'description': 'Isolation exercise for chest',
            'steps': 'Set pulleys at chest height\nBring handles together',
        })
        self.assertEqual(res_post.status_code, status.HTTP_201_CREATED)
        ex_id = res_post.data['id']

        # PATCH
        res_patch = self.client.patch(f'/api/v1/workouts/exercises/{ex_id}/', data={
            'equipment': 'Adjustable Cable Pulley',
        })
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)

        # DELETE
        res_del = self.client.delete(f'/api/v1/workouts/exercises/{ex_id}/')
        self.assertIn(res_del.status_code, [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT])
        self.assertFalse(Exercise.objects.filter(id=ex_id).exists())

    # ==========================================================================
    # G. GLOBAL MEAL LOG MANAGEMENT TESTS
    # ==========================================================================

    def test_admin_meal_logs_list_filter_and_delete(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.superuser_token}')
        url = '/api/v1/admin/meals/'

        # 1. List
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertGreaterEqual(response.data['count'], 1)

        # 2. Filter by user_id
        res_user = self.client.get(f'{url}?user_id={self.regular_user.id}')
        self.assertEqual(res_user.status_code, status.HTTP_200_OK)
        self.assertEqual(res_user.data['count'], 1)

        # 3. Filter by date
        today_str = date.today().strftime('%Y-%m-%d')
        res_date = self.client.get(f'{url}?date={today_str}')
        self.assertEqual(res_date.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res_date.data['count'], 1)

        # 4. DELETE
        del_url = f'/api/v1/admin/meals/{self.meal_log.id}/'
        res_del = self.client.delete(del_url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertFalse(MealLog.objects.filter(id=self.meal_log.id).exists())
