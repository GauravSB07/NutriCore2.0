from datetime import date
from django.contrib.auth.models import User
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from Nutrition.models import Food, Category, MealLog, WaterIntake
from Users.models import Profile


class NutritionAPITests(APITestCase):
    def setUp(self):
        # Create categories
        self.category_fruit = Category.objects.create(name='Fruits')
        self.category_protein = Category.objects.create(name='Proteins')

        # Create sample foods
        self.food_chicken = Food.objects.create(
            name='Chicken Breast Test',
            calories_per_100g=165.0,
            protein_per_100g=31.0,
            unit_type='g',
            serving_name='Breast fillet',
            serving_quantity=150.0,
        )
        self.food_chicken.categories.add(self.category_protein)

        self.food_apple = Food.objects.create(
            name='Fresh Apple Test',
            calories_per_100g=52.0,
            protein_per_100g=0.3,
            calories_per_unit=95.0,
            protein_per_unit=0.5,
            unit_type='unit',
            serving_name='Medium Apple',
            serving_quantity=1.0,
        )
        self.food_apple.categories.add(self.category_fruit)

        # Create food with image
        small_gif = (
            b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00'
            b'\xff\xff\xff\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00'
            b'\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
        )
        self.food_with_image = Food.objects.create(
            name='Protein Shake Test',
            calories_per_100g=80.0,
            protein_per_100g=15.0,
            unit_type='ml',
            image=SimpleUploadedFile('test_shake.gif', small_gif, content_type='image/gif'),
        )
        self.food_with_image.categories.add(self.category_protein)

        # Create Primary User
        self.user = User.objects.create_user(
            username='nutri_tester',
            email='nutri@example.com',
            password='TestPassword123!',
        )
        self.profile = self.user.profile
        self.profile.daily_calorie_target = 2200.0
        self.profile.daily_protein_target = 140.0
        self.profile.daily_water_goal = 3000.0
        self.profile.points = 100
        self.profile.max_cheat_calories_per_day = 400.0
        self.profile.max_cheat_meals_per_day = 2
        self.profile.save()

        # Create Secondary User (for isolation tests)
        self.other_user = User.objects.create_user(
            username='other_nutri_user',
            email='other@example.com',
            password='OtherPassword123!',
        )
        self.other_profile = self.other_user.profile
        self.other_profile.points = 50
        self.other_profile.save()

        # Generate JWT tokens
        self.token = str(RefreshToken.for_user(self.user).access_token)
        self.other_token = str(RefreshToken.for_user(self.other_user).access_token)

        # Helper method for authenticated requests
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    def tearDown(self):
        # Clean up uploaded test files
        if self.food_with_image.image:
            try:
                self.food_with_image.image.delete(save=False)
            except Exception:
                pass

    # --------------------------------------------------------------------------
    # 1. Food Catalogue Tests (Public)
    # --------------------------------------------------------------------------

    def test_food_catalogue_retrieval_public(self):
        """Food catalogue must be publicly accessible and return paginated results with macros."""
        self.client.credentials()  # Unauthenticated
        url = reverse('api_nutrition_foods')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertIn('count', response.data)
        self.assertGreaterEqual(response.data['count'], 3)

        first_item = response.data['results'][0]
        self.assertIn('id', first_item)
        self.assertIn('name', first_item)
        self.assertIn('calories_per_100g', first_item)
        self.assertIn('protein_per_100g', first_item)
        self.assertIn('categories', first_item)

    def test_food_search(self):
        """Foods should be filterable by name search query."""
        self.client.credentials()
        url = reverse('api_nutrition_foods')
        response = self.client.get(url, {'search': 'Chicken'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], 'Chicken Breast Test')

    def test_food_category_filtering(self):
        """Foods should be filterable by category ID."""
        self.client.credentials()
        url = reverse('api_nutrition_foods')
        response = self.client.get(url, {'category': self.category_fruit.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], 'Fresh Apple Test')

    def test_food_detail(self):
        """Food detail endpoint should return full food item info."""
        self.client.credentials()
        url = reverse('api_nutrition_food_detail', kwargs={'id': self.food_apple.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.food_apple.id)
        self.assertEqual(response.data['calories_per_unit'], 95.0)
        self.assertEqual(response.data['protein_per_unit'], 0.5)

    def test_food_detail_not_found(self):
        """Nonexistent food ID should return 404."""
        self.client.credentials()
        url = reverse('api_nutrition_food_detail', kwargs={'id': 999999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_categories_list(self):
        """Categories endpoint should return all categories with food counts."""
        self.client.credentials()
        url = reverse('api_nutrition_categories')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        category_names = [c['name'] for c in response.data]
        self.assertIn('Fruits', category_names)
        self.assertIn('Proteins', category_names)

    def test_food_image_url_generation(self):
        """Foods with images must return a valid image_url string."""
        self.client.credentials()
        url = reverse('api_nutrition_food_detail', kwargs={'id': self.food_with_image.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data['image_url'])
        self.assertTrue(len(response.data['image_url']) > 0)

    # --------------------------------------------------------------------------
    # 2. Meal Log Tests (Authenticated & Scoped)
    # --------------------------------------------------------------------------

    def test_meal_creation_with_grams(self):
        """Logging 200g of chicken (165 cal/100g, 31g prot/100g) must calculate 330 cal and 62g protein."""
        url = reverse('api_nutrition_meals')
        payload = {
            'food_id': self.food_chicken.id,
            'quantity': 200.0,
            'unit': 'g',
        }
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['calories'], 330.0)
        self.assertEqual(response.data['protein'], 62.0)
        self.assertEqual(response.data['unit'], 'g')

        # Verify DB entry
        meal_id = response.data['id']
        meal = MealLog.objects.get(id=meal_id)
        self.assertEqual(meal.user, self.user)
        self.assertEqual(meal.calories, 330.0)
        self.assertEqual(meal.protein, 62.0)

    def test_meal_creation_with_servings(self):
        """Logging 2 servings of chicken (150g serving -> 300g total) must calculate 495 cal and 93g protein."""
        url = reverse('api_nutrition_meals')
        payload = {
            'food_id': self.food_chicken.id,
            'quantity': 2.0,
            'unit': 'serving',
        }
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['calories'], 495.0)
        self.assertEqual(response.data['protein'], 93.0)

    def test_meal_creation_with_units(self):
        """Logging 2 apples (95 cal/unit, 0.5g prot/unit) must calculate 190 cal and 1.0g protein."""
        url = reverse('api_nutrition_meals')
        payload = {
            'food_id': self.food_apple.id,
            'quantity': 2.0,
            'unit': 'unit',
        }
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['calories'], 190.0)
        self.assertEqual(response.data['protein'], 1.0)

    def test_meal_update(self):
        """Updating meal quantity must automatically recalculate calories and protein."""
        # Create meal
        meal = MealLog.objects.create(
            user=self.user,
            food=self.food_chicken,
            quantity=100.0,
            unit='g',
        )

        url = reverse('api_nutrition_meal_detail', kwargs={'id': meal.id})
        response = self.client.patch(url, {'quantity': 300.0}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['calories'], 495.0)
        self.assertEqual(response.data['protein'], 93.0)

        meal.refresh_from_db()
        self.assertEqual(meal.quantity, 300.0)
        self.assertEqual(meal.calories, 495.0)

    def test_meal_deletion(self):
        """User must be able to delete their own meal log."""
        meal = MealLog.objects.create(
            user=self.user,
            food=self.food_chicken,
            quantity=100.0,
            unit='g',
        )

        url = reverse('api_nutrition_meal_detail', kwargs={'id': meal.id})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(MealLog.objects.filter(id=meal.id).exists())

    def test_user_data_isolation_meals(self):
        """A user must never access, update, or delete another user's meal log."""
        meal_user_a = MealLog.objects.create(
            user=self.user,
            food=self.food_chicken,
            quantity=100.0,
            unit='g',
        )

        # Switch to User B
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.other_token}')

        # User B queries meals list -> User A's meal should not appear
        list_url = reverse('api_nutrition_meals')
        list_resp = self.client.get(list_url)
        meal_ids = [m['id'] for m in list_resp.data['results']]
        self.assertNotIn(meal_user_a.id, meal_ids)

        # User B attempts to GET User A's meal directly -> 404
        detail_url = reverse('api_nutrition_meal_detail', kwargs={'id': meal_user_a.id})
        self.assertEqual(self.client.get(detail_url).status_code, status.HTTP_404_NOT_FOUND)

        # User B attempts to PATCH User A's meal -> 404
        self.assertEqual(self.client.patch(detail_url, {'quantity': 999}).status_code, status.HTTP_404_NOT_FOUND)

        # User B attempts to DELETE User A's meal -> 404
        self.assertEqual(self.client.delete(detail_url).status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_meal_inputs(self):
        """Validation errors must be returned for non-existent food IDs or invalid quantities."""
        url = reverse('api_nutrition_meals')

        # Invalid food_id
        resp_bad_food = self.client.post(url, {'food_id': 99999, 'quantity': 100}, format='json')
        self.assertEqual(resp_bad_food.status_code, status.HTTP_400_BAD_REQUEST)

        # Zero or negative quantity
        resp_bad_qty = self.client.post(url, {'food_id': self.food_chicken.id, 'quantity': -50}, format='json')
        self.assertEqual(resp_bad_qty.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_meal_access_rejected(self):
        """Meals endpoint must reject unauthenticated requests with 401."""
        self.client.credentials()  # Clear auth
        url = reverse('api_nutrition_meals')
        self.assertEqual(self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.post(url, {}).status_code, status.HTTP_401_UNAUTHORIZED)

    # --------------------------------------------------------------------------
    # 3. Daily Nutrition Summary Tests
    # --------------------------------------------------------------------------

    def test_daily_nutrition_summary(self):
        """Daily summary must aggregate calories, protein, targets, percentages, and water."""
        today = date.today()

        # Log two meals for today
        MealLog.objects.create(
            user=self.user,
            food=self.food_chicken,
            quantity=200.0,
            unit='g',
            date=today,
        )  # 330 cal, 62g protein
        MealLog.objects.create(
            user=self.user,
            food=self.food_apple,
            quantity=2.0,
            unit='unit',
            date=today,
        )  # 190 cal, 1g protein

        # Log water intake
        WaterIntake.objects.create(user=self.user, amount=1000.0, date=today)

        url = reverse('api_nutrition_summary')
        response = self.client.get(url, {'date': str(today)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        # Calories
        self.assertEqual(data['calories']['consumed'], 520.0)
        self.assertEqual(data['calories']['target'], 2200.0)
        self.assertEqual(data['calories']['remaining'], 1680.0)
        self.assertAlmostEqual(data['calories']['percentage'], 23.6, places=1)

        # Protein
        self.assertEqual(data['macronutrients']['protein']['consumed'], 63.0)
        self.assertEqual(data['macronutrients']['protein']['target'], 140.0)

        # Water
        self.assertEqual(data['water_summary']['total_consumed_ml'], 1000.0)
        self.assertEqual(data['water_summary']['goal_ml'], 3000.0)
        self.assertEqual(data['water_summary']['remaining_ml'], 2000.0)

        # Meals list
        self.assertEqual(data['meal_count'], 2)

    # --------------------------------------------------------------------------
    # 4. Water Intake Tests
    # --------------------------------------------------------------------------

    def test_water_intake_lifecycle(self):
        """Water intake can be created, retrieved, updated, and deleted."""
        url = reverse('api_nutrition_water')

        # Log 500 ml
        create_resp = self.client.post(url, {'amount': 500.0}, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_resp.data['record']['amount'], 500.0)
        self.assertEqual(create_resp.data['daily_total_ml'], 500.0)

        record_id = create_resp.data['record']['id']

        # Log another 250 ml
        self.client.post(url, {'amount': 250.0}, format='json')

        # Retrieve daily water logs
        get_resp = self.client.get(url)
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(get_resp.data['total_consumed_ml'], 750.0)
        self.assertEqual(len(get_resp.data['records']), 2)

        # Update first entry to 600 ml
        detail_url = reverse('api_nutrition_water_detail', kwargs={'id': record_id})
        patch_resp = self.client.patch(detail_url, {'amount': 600.0}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['amount'], 600.0)

        # Delete first entry
        del_resp = self.client.delete(detail_url)
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(WaterIntake.objects.filter(id=record_id).exists())

    def test_water_intake_isolation(self):
        """User B cannot access or modify User A's water intake records."""
        entry_a = WaterIntake.objects.create(user=self.user, amount=500.0)

        # Switch to User B
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.other_token}')

        detail_url = reverse('api_nutrition_water_detail', kwargs={'id': entry_a.id})
        self.assertEqual(self.client.patch(detail_url, {'amount': 1000.0}).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(detail_url).status_code, status.HTTP_404_NOT_FOUND)

    # --------------------------------------------------------------------------
    # 5. Cheat Meal Tests
    # --------------------------------------------------------------------------

    def test_cheat_meal_logging_with_points_deduction(self):
        """Logging a cheat meal must deduct 1 point per 4 calories from profile points."""
        initial_points = self.user.profile.points  # 100 points
        # 100g chicken = 165 calories -> int(165 / 4) = 41 points
        url = reverse('api_nutrition_cheat_create')
        payload = {
            'food_id': self.food_chicken.id,
            'quantity': 100.0,
            'unit': 'g',
        }
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['points_deducted'], 41)
        self.assertEqual(response.data['remaining_points'], initial_points - 41)

        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.points, initial_points - 41)

    def test_cheat_meal_insufficient_points_rejected(self):
        """Cheat meal must be rejected if user does not have sufficient points."""
        self.user.profile.points = 10
        self.user.profile.save()

        # 100g chicken = 165 cal -> requires 41 points
        url = reverse('api_nutrition_cheat_create')
        payload = {
            'food_id': self.food_chicken.id,
            'quantity': 100.0,
            'unit': 'g',
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cheat_meal_status_endpoint(self):
        """Cheat status endpoint must return point balances, limits, and allowances."""
        url = reverse('api_nutrition_cheat_status')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['points'], 100)
        self.assertEqual(response.data['max_cheat_calories'], 400.0)
        self.assertEqual(response.data['max_cheat_meals'], 2)
        self.assertTrue(response.data['can_log_cheat'])

    # --------------------------------------------------------------------------
    # 6. Existing Django Nutrition Pages Verification
    # --------------------------------------------------------------------------

    def test_existing_nutrition_pages(self):
        """Verify that existing Django HTML page routes remain fully operational."""
        # Public food catalogue page
        resp_foods = self.client.get(reverse('nutrition:food_list'))
        self.assertEqual(resp_foods.status_code, status.HTTP_200_OK)

        # Unauthenticated redirects to login
        self.client.credentials()  # Clear auth
        resp_log_unauth = self.client.get(reverse('nutrition:log_meal'))
        self.assertEqual(resp_log_unauth.status_code, status.HTTP_302_FOUND)

        resp_water_unauth = self.client.get(reverse('nutrition:log_water'))
        self.assertEqual(resp_water_unauth.status_code, status.HTTP_302_FOUND)

        # Authenticated session pages
        self.client.force_login(self.user)
        resp_log_auth = self.client.get(reverse('nutrition:log_meal'))
        self.assertEqual(resp_log_auth.status_code, status.HTTP_200_OK)

        resp_list_auth = self.client.get(reverse('nutrition:meal_list'))
        self.assertEqual(resp_list_auth.status_code, status.HTTP_200_OK)

        resp_water_auth = self.client.get(reverse('nutrition:log_water'))
        self.assertEqual(resp_water_auth.status_code, status.HTTP_200_OK)

