import os
import sys
import django
import urllib.request

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NutriCore.settings')
django.setup()

from django.contrib.auth.models import User
from Nutrition.models import Food, MealLog
from Nutrition.api.serializers import FoodSerializer, MealLogCreateUpdateSerializer

def test_food_images():
    print("=== Testing Issue 1: Food Images ===")
    food_with_img = Food.objects.exclude(image='').first()
    assert food_with_img is not None, "No food with image found in database"
    
    serializer = FoodSerializer(food_with_img)
    data = serializer.data
    
    assert 'image_url' in data, "image_url missing from FoodSerializer"
    assert 'image' in data, "image missing from FoodSerializer"
    assert data['image'] == data['image_url'], "image and image_url do not match"
    assert data['image'].startswith('https://'), f"Expected HTTPS url, got {data['image']}"
    print(f"PASS: Food '{food_with_img.name}' has both 'image' and 'image_url'")
    print(f"URL: {data['image']}")
    
    req = urllib.request.Request(data['image'])
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Expected 200 OK from storage, got {resp.status}"
        content_type = resp.headers.get('content-type')
        print(f"PASS: Supabase Storage returned {resp.status} {content_type}")

def test_meal_calculations():
    print("\n=== Testing Issue 2: Meal Calculations ===")
    user = User.objects.first()
    
    # 1. Food with calories_per_100g (White Rice Cooked: 130 kcal/100g, 2.5g prot)
    f_rice = Food.objects.filter(calories_per_100g__gt=0).first()
    m1 = MealLog(user=user, food=f_rice, quantity=200, unit='g')
    m1.save()
    expected_cal = round((f_rice.calories_per_100g / 100.0) * 200, 2)
    expected_prot = round((f_rice.protein_per_100g / 100.0) * 200, 2)
    assert m1.calories == expected_cal, f"Expected {expected_cal}, got {m1.calories}"
    assert m1.protein == expected_prot, f"Expected {expected_prot}, got {m1.protein}"
    print(f"PASS: {f_rice.name} (200g): {m1.calories} kcal, {m1.protein}g protein")
    m1.delete()
    
    # 2. Food with calories_per_unit only (Roti: 120 kcal/unit, 3g prot)
    f_roti = Food.objects.filter(calories_per_100g__isnull=True, calories_per_unit__gt=0).first()
    m2 = MealLog(user=user, food=f_roti, quantity=3, unit='unit')
    m2.save()
    assert m2.calories == round(f_roti.calories_per_unit * 3, 2), f"Expected {f_roti.calories_per_unit * 3}, got {m2.calories}"
    print(f"PASS: {f_roti.name} (3 units): {m2.calories} kcal, {m2.protein}g protein")
    m2.delete()
    
    # 3. Food with calories_per_unit logged with unit='piece' (synonym for unit)
    m3 = MealLog(user=user, food=f_roti, quantity=2, unit='piece')
    m3.save()
    assert m3.calories == round(f_roti.calories_per_unit * 2, 2)
    assert m3.unit == 'unit', "piece should be normalized to unit"
    print(f"PASS: {f_roti.name} (2 pieces): {m3.calories} kcal (normalized unit: {m3.unit})")
    m3.delete()

    # 4. Food with calories_per_unit but unit_type='g' in DB (e.g. Aloo Kulcha id=980) logged as 'g'
    f_kulcha = Food.objects.filter(id=980).first()
    if f_kulcha:
        m4 = MealLog(user=user, food=f_kulcha, quantity=2, unit='g')
        m4.save()
        assert m4.calories == round(f_kulcha.calories_per_unit * 2, 2), f"Expected {f_kulcha.calories_per_unit * 2}, got {m4.calories}"
        print(f"PASS: {f_kulcha.name} (2 units with g fallback): {m4.calories} kcal, {m4.protein}g protein")
        m4.delete()
        
    # 5. Food logged as serving
    f_serving = Food.objects.filter(serving_quantity__gt=0, calories_per_100g__gt=0).first()
    if f_serving:
        m5 = MealLog(user=user, food=f_serving, quantity=1, unit='serving')
        m5.save()
        expected = round((f_serving.calories_per_100g / 100.0) * f_serving.serving_quantity, 2)
        assert m5.calories == expected, f"Expected {expected}, got {m5.calories}"
        print(f"PASS: {f_serving.name} (1 serving = {f_serving.serving_quantity}g): {m5.calories} kcal")
        m5.delete()

def test_serializer_validation():
    print("\n=== Testing Serializer Validation & Backend Search ===")
    f_rice = Food.objects.filter(calories_per_100g__gt=0).first()
    s = MealLogCreateUpdateSerializer(data={
        'food_id': f_rice.id,
        'quantity': 100,
        'unit': 'piece',
    })
    assert s.is_valid(), f"Serializer errors: {s.errors}"
    assert s.validated_data['unit'] == 'unit', "Expected unit to be normalized to unit"
    print("PASS: MealLogCreateUpdateSerializer accepts 'piece' and normalizes to 'unit'")

if __name__ == '__main__':
    test_food_images()
    test_meal_calculations()
    test_serializer_validation()
    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")
