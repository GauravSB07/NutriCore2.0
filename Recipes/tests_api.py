from django.contrib.auth.models import User
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from Recipes.models import Recipe, RecipeCategory


class RecipeAPITests(APITestCase):
    def setUp(self):
        # Create categories
        self.cat_high_protein = RecipeCategory.objects.create(name='High Protein Meals')
        self.cat_veg = RecipeCategory.objects.create(name='Pure Veg Dishes')

        # Create sample gif image
        small_gif = (
            b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00'
            b'\xff\xff\xff\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00'
            b'\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
        )
        self.sample_image = SimpleUploadedFile('test_recipe.gif', small_gif, content_type='image/gif')

        # Create sample recipes
        self.recipe_chicken = Recipe.objects.create(
            name='Grilled Chicken Salad Test',
            category=self.cat_high_protein,
            calories=350.0,
            protein=42.0,
            price=12.5,
            ingredients='200g Chicken Breast; 50g Lettuce; 1 tbsp Olive Oil; Salt and Pepper',
            method='Season the chicken breast with salt and pepper. Grill for 6 minutes per side. Slice and toss with lettuce and olive oil.',
            tips='Do not overcook the chicken breast to maintain juiciness; Use extra virgin olive oil',
            image=self.sample_image,
        )

        self.recipe_paneer = Recipe.objects.create(
            name='Tofu Veggie Stir Fry Test',
            category=self.cat_veg,
            calories=250.0,
            protein=18.0,
            price=8.0,
            ingredients='150g Tofu; 100g Broccoli; 1 tbsp Soy Sauce',
            method='Chop tofu and broccoli. Stir fry in skillet for 5 minutes. Add soy sauce and simmer for 2 minutes.',
            tips='Press tofu to remove excess moisture',
        )

        # Regular user (non-staff)
        self.user = User.objects.create_user(
            username='recipe_user',
            email='recipe_user@example.com',
            password='TestPassword123!',
        )
        self.user_token = str(RefreshToken.for_user(self.user).access_token)

        # Admin / Staff user
        self.admin = User.objects.create_superuser(
            username='recipe_admin',
            email='recipe_admin@example.com',
            password='AdminPassword123!',
        )
        self.admin_token = str(RefreshToken.for_user(self.admin).access_token)

    def tearDown(self):
        if self.recipe_chicken.image:
            try:
                self.recipe_chicken.image.delete(save=False)
            except Exception:
                pass

    # --------------------------------------------------------------------------
    # 1. Public Recipe Catalogue Tests
    # --------------------------------------------------------------------------

    def test_recipe_list_public(self):
        """Recipe catalogue listing is public, paginated, and returns recipe summaries."""
        url = reverse('api_recipes_list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('count', response.data)
        self.assertIn('results', response.data)
        self.assertGreaterEqual(response.data['count'], 2)
        names = [r['name'] for r in response.data['results']]
        self.assertIn('Grilled Chicken Salad Test', names)
        self.assertIn('Tofu Veggie Stir Fry Test', names)

    def test_recipe_search_and_ordering(self):
        """Recipes can be searched by name and ordered."""
        url = reverse('api_recipes_list')

        # Search query
        search_resp = self.client.get(url, {'search': 'Chicken'})
        self.assertEqual(search_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(search_resp.data['count'], 1)
        self.assertEqual(search_resp.data['results'][0]['name'], 'Grilled Chicken Salad Test')

        # Ordering by calories ascending
        order_resp = self.client.get(url, {'ordering': 'calories'})
        self.assertEqual(order_resp.status_code, status.HTTP_200_OK)
        first_cal = order_resp.data['results'][0]['calories']
        second_cal = order_resp.data['results'][1]['calories']
        self.assertLessEqual(first_cal, second_cal)

    def test_recipe_filtering_by_category_and_type(self):
        """Recipes can be filtered by category ID and special filter types."""
        url = reverse('api_recipes_list')

        # Filter by category
        cat_resp = self.client.get(url, {'category': self.cat_veg.id})
        self.assertEqual(cat_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(cat_resp.data['count'], 1)
        self.assertEqual(cat_resp.data['results'][0]['name'], 'Tofu Veggie Stir Fry Test')

        # Filter: high_protein (protein >= 25)
        hp_resp = self.client.get(url, {'filter': 'high_protein'})
        self.assertEqual(hp_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(hp_resp.data['count'], 1)
        self.assertEqual(hp_resp.data['results'][0]['name'], 'Grilled Chicken Salad Test')

        # Filter: low_cal (calories <= 300)
        lc_resp = self.client.get(url, {'filter': 'low_cal'})
        self.assertEqual(lc_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(lc_resp.data['count'], 1)
        self.assertEqual(lc_resp.data['results'][0]['name'], 'Tofu Veggie Stir Fry Test')

        # Filter: veg (category name contains veg)
        veg_resp = self.client.get(url, {'filter': 'veg'})
        self.assertEqual(veg_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(veg_resp.data['count'], 1)
        self.assertEqual(veg_resp.data['results'][0]['name'], 'Tofu Veggie Stir Fry Test')

    def test_recipe_detail_public(self):
        """Recipe detail returns complete info, parsed ingredients, steps, and tips."""
        url = reverse('api_recipes_detail', kwargs={'id': self.recipe_chicken.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.recipe_chicken.id)
        self.assertEqual(response.data['name'], 'Grilled Chicken Salad Test')
        self.assertEqual(response.data['calories'], 350.0)
        self.assertEqual(response.data['protein'], 42.0)
        self.assertEqual(response.data['price'], 12.5)

        # Check parsed ingredients
        self.assertEqual(len(response.data['ingredients_list']), 4)
        self.assertEqual(response.data['ingredients_list'][0], '200g Chicken Breast')

        # Check parsed steps
        self.assertEqual(len(response.data['steps_list']), 3)
        self.assertEqual(response.data['steps_list'][0], 'Season the chicken breast with salt and pepper')

        # Check parsed tips
        self.assertEqual(len(response.data['tips_list']), 2)

        # Check image URL
        self.assertIsNotNone(response.data['image_url'])

    def test_recipe_detail_not_found(self):
        """Nonexistent recipe ID returns 404."""
        url = reverse('api_recipes_detail', kwargs={'id': 99999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # --------------------------------------------------------------------------
    # 2. Recipe Categories Tests
    # --------------------------------------------------------------------------

    def test_recipe_categories_list_and_detail(self):
        """Recipe categories endpoint returns categories with counts and nested recipes."""
        list_url = reverse('api_recipes_categories')
        list_resp = self.client.get(list_url)

        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(list_resp.data), 2)
        cat_names = [c['name'] for c in list_resp.data]
        self.assertIn('High Protein Meals', cat_names)

        # Detail
        detail_url = reverse('api_recipes_category_detail', kwargs={'id': self.cat_high_protein.id})
        det_resp = self.client.get(detail_url)

        self.assertEqual(det_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(det_resp.data['id'], self.cat_high_protein.id)
        self.assertEqual(det_resp.data['name'], 'High Protein Meals')
        self.assertEqual(len(det_resp.data['recipes']), 1)
        self.assertEqual(det_resp.data['recipes'][0]['name'], 'Grilled Chicken Salad Test')

    def test_recipe_category_not_found(self):
        """Nonexistent category ID returns 404."""
        url = reverse('api_recipes_category_detail', kwargs={'id': 99999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # --------------------------------------------------------------------------
    # 3. Administrative Recipe Management Tests
    # --------------------------------------------------------------------------

    def test_admin_permissions_enforced(self):
        """Unauthenticated requests return 401, non-staff requests return 403 on write endpoints."""
        url = reverse('api_recipes_list')
        payload = {'name': 'Unauthorized Recipe', 'method': 'Mix everything.'}

        # Unauthenticated POST -> 401
        self.client.credentials()
        unauth_resp = self.client.post(url, payload, format='json')
        self.assertEqual(unauth_resp.status_code, status.HTTP_401_UNAUTHORIZED)

        # Regular user POST -> 403
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.user_token}')
        user_resp = self.client.post(url, payload, format='json')
        self.assertEqual(user_resp.status_code, status.HTTP_403_FORBIDDEN)

        # Regular user PATCH -> 403
        detail_url = reverse('api_recipes_detail', kwargs={'id': self.recipe_chicken.id})
        patch_resp = self.client.patch(detail_url, {'name': 'Hacked'}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_403_FORBIDDEN)

        # Regular user DELETE -> 403
        del_resp = self.client.delete(detail_url)
        self.assertEqual(del_resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_recipe_lifecycle(self):
        """Staff/superuser can create, update, and delete recipes."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')

        # 1. Create recipe
        create_url = reverse('api_recipes_list')
        create_payload = {
            'name': 'Admin Salmon Feast',
            'category_id': self.cat_high_protein.id,
            'calories': 450.0,
            'protein': 38.0,
            'price': 16.0,
            'ingredients': '200g Salmon; 1 Lemon; Fresh Dill',
            'method': 'Season salmon with lemon and dill. Pan sear skin down for 4 minutes. Flip and cook 3 minutes.',
            'tips': 'Crispy skin requires high heat',
        }
        create_resp = self.client.post(create_url, create_payload, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        new_id = create_resp.data['id']
        self.assertEqual(create_resp.data['name'], 'Admin Salmon Feast')

        # 2. Update recipe
        detail_url = reverse('api_recipes_detail', kwargs={'id': new_id})
        patch_resp = self.client.patch(detail_url, {'price': 17.5, 'calories': 460.0}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['price'], 17.5)
        self.assertEqual(patch_resp.data['calories'], 460.0)

        # 3. Delete recipe
        del_resp = self.client.delete(detail_url)
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(Recipe.objects.filter(id=new_id).exists())

    def test_admin_category_lifecycle(self):
        """Staff/superuser can create, update, and delete recipe categories."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')

        # 1. Create category
        create_url = reverse('api_recipes_categories')
        create_resp = self.client.post(create_url, {'name': 'Keto Friendly'}, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        cat_id = create_resp.data['id']

        # 2. Update category
        detail_url = reverse('api_recipes_category_detail', kwargs={'id': cat_id})
        patch_resp = self.client.patch(detail_url, {'name': 'Strict Keto'}, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_resp.data['name'], 'Strict Keto')

        # 3. Delete category
        del_resp = self.client.delete(detail_url)
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(RecipeCategory.objects.filter(id=cat_id).exists())

    def test_invalid_admin_inputs(self):
        """Negative calories, negative protein, or negative price must return 400 Bad Request."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.admin_token}')
        url = reverse('api_recipes_list')

        # Negative calories
        bad_cal = self.client.post(url, {'name': 'Bad', 'method': 'Mix.', 'calories': -50.0}, format='json')
        self.assertEqual(bad_cal.status_code, status.HTTP_400_BAD_REQUEST)

        # Negative protein
        bad_pro = self.client.post(url, {'name': 'Bad', 'method': 'Mix.', 'protein': -10.0}, format='json')
        self.assertEqual(bad_pro.status_code, status.HTTP_400_BAD_REQUEST)

        # Missing method
        bad_method = self.client.post(url, {'name': 'Bad'}, format='json')
        self.assertEqual(bad_method.status_code, status.HTTP_400_BAD_REQUEST)

    # --------------------------------------------------------------------------
    # 4. Existing Django Recipe HTML Pages Verification
    # --------------------------------------------------------------------------

    def test_existing_django_recipe_views(self):
        """Verify that existing Django HTML page routes and AJAX endpoint continue working."""
        # Standard HTML list
        resp_list = self.client.get(reverse('recipes:recipe_list'))
        self.assertEqual(resp_list.status_code, status.HTTP_200_OK)

        # Standard HTML detail
        resp_detail = self.client.get(reverse('recipes:recipe_detail', kwargs={'id': self.recipe_chicken.id}))
        self.assertEqual(resp_detail.status_code, status.HTTP_200_OK)

        # AJAX recipe list
        resp_ajax = self.client.get(reverse('recipes:recipe_list'), HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        self.assertEqual(resp_ajax.status_code, status.HTTP_200_OK)
        self.assertIn('recipes', resp_ajax.json())
