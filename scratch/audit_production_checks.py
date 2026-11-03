import os
import psycopg2
import requests
from dotenv import dotenv_values

def run_checks():
    env = dotenv_values('.env')
    db_url = env.get('DATABASE_URL')
    sp_url = env.get('SUPABASE_URL', '').rstrip('/')
    bucket = env.get('SUPABASE_STORAGE_BUCKET', 'nutricore-media')
    
    print("=== 1. FOREIGN KEY & REFERENTIAL INTEGRITY AUDIT ===")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute('''
        SELECT
            tc.table_name, kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public'
        ORDER BY tc.table_name, kcu.column_name;
    ''')
    fks = cur.fetchall()
    print(f"Total Foreign Key Constraints: {len(fks)}")
    
    queries = [
        ("Workouts_exercise.sub_muscle_id -> Workouts_submuscle",
         'SELECT COUNT(*) FROM "Workouts_exercise" WHERE sub_muscle_id NOT IN (SELECT id FROM "Workouts_submuscle");'),
        ("Workouts_submuscle.muscle_group_id -> Workouts_musclegroup",
         'SELECT COUNT(*) FROM "Workouts_submuscle" WHERE muscle_group_id NOT IN (SELECT id FROM "Workouts_musclegroup");'),
        ("Recipes_recipe.category_id -> Recipes_recipecategory",
         'SELECT COUNT(*) FROM "Recipes_recipe" WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM "Recipes_recipecategory");'),
        ("Nutrition_food_categories -> Nutrition_food / Nutrition_category",
         'SELECT COUNT(*) FROM "Nutrition_food_categories" WHERE food_id NOT IN (SELECT id FROM "Nutrition_food") OR category_id NOT IN (SELECT id FROM "Nutrition_category");'),
    ]
    for label, q in queries:
        cur.execute(q)
        cnt = cur.fetchone()[0]
        print(f"  • {label}: {cnt} orphan rows ({'PASS' if cnt == 0 else 'FAIL'})")
        
    cur.close()
    conn.close()

if __name__ == '__main__':
    run_checks()

