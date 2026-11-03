import os
from dotenv import dotenv_values
import psycopg2
import requests

def audit_cutover():
    env_mumbai = dotenv_values('.env.mumbai')
    mumbai_db = env_mumbai.get('MUMBAI_DATABASE_URL')
    mumbai_sp_url = env_mumbai.get('MUMBAI_SUPABASE_URL', '').rstrip('/')
    mumbai_bucket = env_mumbai.get('MUMBAI_STORAGE_BUCKET', 'nutricore-media')

    print("=== MUMBAI DATABASE IMAGE COLUMN AUDIT ===")
    conn = psycopg2.connect(mumbai_db)
    cur = conn.cursor()

    tables = [
        ('Nutrition_food', 'image'),
        ('Workouts_musclegroup', 'image'),
        ('Workouts_submuscle', 'image'),
        ('Workouts_exercise', 'image'),
        ('Recipes_recipe', 'image'),
    ]

    has_hardcoded_urls = False
    for table, col in tables:
        cur.execute(f'SELECT id, name, "{col}" FROM "{table}" WHERE "{col}" IS NOT NULL AND "{col}" != \'\' LIMIT 3;')
        rows = cur.fetchall()
        print(f"\nTable: {table}")
        for r in rows:
            val = str(r[2])
            print(f"  ID {r[0]} ({r[1]}): {val}")
            if val.startswith(('http://', 'https://')):
                has_hardcoded_urls = True
                print(f"    [!] Hardcoded URL detected: {val}")

    print(f"\nHardcoded URLs found in database image columns: {has_hardcoded_urls}")

    # Check whether any row in the entire DB contains 'sqmvywntkdnrcnfplxer' or 'eu-west-1'
    print("\n=== SCANNING FOR IRELAND PROJECT REF IN MUMBAI DATABASE ===")
    for table, col in tables:
        cur.execute(f'SELECT COUNT(*) FROM "{table}" WHERE "{col}" LIKE \'%sqmvywntkdnrcnfplxer%\' OR "{col}" LIKE \'%eu-west-1%\';')
        cnt = cur.fetchone()[0]
        print(f"  {table}.{col} matches: {cnt}")

    # Check table count and catalogue records in Mumbai
    print("\n=== MUMBAI CATALOGUE COUNTS ===")
    catalogue_models = [
        ("Nutrition_category", 18),
        ("Nutrition_food", 270),
        ("Nutrition_food_categories", 535),
        ("Recipes_recipecategory", 11),
        ("Recipes_recipe", 27),
        ("Workouts_musclegroup", 8),
        ("Workouts_submuscle", 27),
        ("Workouts_exercise", 87),
    ]
    for tbl, expected in catalogue_models:
        cur.execute(f'SELECT COUNT(*) FROM "{tbl}";')
        actual = cur.fetchone()[0]
        status = "MATCH" if actual == expected else "MISMATCH"
        print(f"  {tbl:<30}: Actual = {actual:3d} | Expected = {expected:3d} [{status}]")

    cur.close()
    conn.close()

    # Test representative generated image URLs from Mumbai
    print("\n=== TEST REPRESENTATIVE IMAGE URLS FROM MUMBAI ===")
    sample_images = [
        ("Food", "foods/Chicken_Nuggets_Fried.jpg"),
        ("Muscle", "muscles/back.jpeg"),
        ("Sub-Muscle", "submuscles/Lats.png"),
        ("Exercise", "exercise_images/Incline_barbell_press.png"),
        ("Recipe", "recipes/Chicken_Lettuce_Wraps.jpg"),
        ("Static UI", "static/images/Water_img.jpg"),
    ]
    for label, path in sample_images:
        url = f"{mumbai_sp_url}/storage/v1/object/public/{mumbai_bucket}/{path}"
        resp = requests.head(url, timeout=10)
        ctype = resp.headers.get('Content-Type')
        clen = resp.headers.get('Content-Length')
        print(f"  {label:<12} ({path:<38}): HTTP {resp.status_code} | {ctype} | {clen} B")
        print(f"    URL: {url}")

if __name__ == '__main__':
    audit_cutover()

