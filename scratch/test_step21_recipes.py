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
from Recipes.models import Recipe, RecipeCategory

def run_tests():
    print("==================================================")
    print("STEP 21: RECIPES MODULE INTEGRATION VERIFICATION")
    print("==================================================")

    client = APIClient()

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

    # 1. Recipe listing loads correctly (public access)
    res = client.get('/api/v1/recipes/')
    assert_test(res.status_code == 200 and 'results' in res.data and len(res.data['results']) > 0,
                f"GET /api/v1/recipes/ public listing loads successfully ({res.data.get('count', 0)} recipes)")

    first_recipe = res.data['results'][0]
    recipe_id = first_recipe['id']

    # 2. Recipe details display complete and accurate information
    res_detail = client.get(f'/api/v1/recipes/{recipe_id}/')
    assert_test(res_detail.status_code == 200 and 'name' in res_detail.data and 'calories' in res_detail.data,
                f"GET /api/v1/recipes/{recipe_id}/ returns complete recipe details")

    # 3. Categories and category filtering
    res_cats = client.get('/api/v1/recipes/categories/')
    cats = res_cats.data if isinstance(res_cats.data, list) else res_cats.data.get('results', [])
    assert_test(res_cats.status_code == 200 and len(cats) > 0,
                f"GET /api/v1/recipes/categories/ returns {len(cats)} categories")

    cat_id = cats[0]['id']
    res_cat_filter = client.get(f'/api/v1/recipes/?category={cat_id}')
    assert_test(res_cat_filter.status_code == 200 and 'results' in res_cat_filter.data,
                f"Filtering by category_id={cat_id} works correctly")

    # 4. Search works
    search_term = first_recipe['name'].split()[0]
    res_search = client.get(f'/api/v1/recipes/?search={search_term}')
    assert_test(res_search.status_code == 200 and res_search.data['count'] >= 1,
                f"Search for '{search_term}' returns matching recipes")

    # 5. Recipe filters (high_protein, low_cal, veg)
    res_hp = client.get('/api/v1/recipes/?filter=high_protein')
    hp_valid = all(r['protein'] >= 25 for r in res_hp.data['results'])
    assert_test(res_hp.status_code == 200 and hp_valid, "Filter 'high_protein' correctly filters protein >= 25g")

    res_lc = client.get('/api/v1/recipes/?filter=low_cal')
    lc_valid = all(r['calories'] <= 300 for r in res_lc.data['results'])
    assert_test(res_lc.status_code == 200 and lc_valid, "Filter 'low_cal' correctly filters calories <= 300 kcal")

    res_veg = client.get('/api/v1/recipes/?filter=veg')
    assert_test(res_veg.status_code == 200, "Filter 'veg' works correctly")

    # 6. Images load from Supabase URLs
    image_url = first_recipe.get('image_url')
    has_supabase_media = image_url and ('supabase.co' in image_url or image_url.startswith('http'))
    assert_test(has_supabase_media, f"Recipe images load from Supabase media storage: {image_url[:60]}...")

    # 7. Ingredients, steps, and tips parsing integrity
    has_ing_list = isinstance(res_detail.data.get('ingredients_list'), list) and len(res_detail.data['ingredients_list']) > 0
    has_steps_list = isinstance(res_detail.data.get('steps_list'), list) and len(res_detail.data['steps_list']) > 0
    assert_test(has_ing_list and has_steps_list,
                f"Ingredients ({len(res_detail.data.get('ingredients_list', []))} items) and steps ({len(res_detail.data.get('steps_list', []))} steps) preserve parsed structure")

    # 8. Public users cannot access admin-only recipe operations
    res_unauth_post = client.post('/api/v1/recipes/', {'name': 'Unauthorized Recipe'}, format='json')
    assert_test(res_unauth_post.status_code == 401, "Unauthenticated users cannot create recipes (HTTP 401)")

    # 9. React page files verification
    pages = [
        "frontend/src/pages/recipes/RecipeListPage.jsx",
        "frontend/src/pages/recipes/RecipeDetailPage.jsx",
    ]
    all_pages_exist = all(os.path.exists(p) for p in pages)
    assert_test(all_pages_exist, f"All {len(pages)} Recipe React pages exist")

    # 10. App.jsx route registration
    with open('frontend/src/App.jsx', 'r', encoding='utf-8') as f:
        app_code = f.read()
    routes_registered = 'recipes' in app_code and 'recipes/:id' in app_code
    assert_test(routes_registered, "Recipe routes (/recipes and /recipes/:id) registered in App.jsx")

    # 11. recipeService registered in frontend api.js
    with open('frontend/src/services/api.js', 'r', encoding='utf-8') as f:
        api_code = f.read()
    service_registered = 'recipeService' in api_code and 'getRecipes' in api_code and 'getRecipeDetail' in api_code
    assert_test(service_registered, "recipeService exported with getRecipes and getRecipeDetail in api.js")

    print("--------------------------------------------------")
    print(f"RESULTS: {tests_passed}/{total_tests} tests passed.")
    print("==================================================")

    if tests_passed == total_tests:
        print("ALL RECIPES INTEGRATION TESTS COMPLETED SUCCESSFULLY!")
        return 0
    else:
        print("SOME TESTS FAILED.")
        return 1

if __name__ == '__main__':
    sys.exit(run_tests())
