import os
import shutil
from dotenv import dotenv_values

def perform_local_cutover():
    print("=== PERFORMING LOCAL CUTOVER TO MUMBAI ===")
    
    # 1. Verify existence of .env and .env.mumbai
    if not os.path.exists('.env'):
        raise FileNotFoundError(".env file not found!")
    if not os.path.exists('.env.mumbai'):
        raise FileNotFoundError(".env.mumbai file not found!")

    # 2. Create backup of .env
    backup_path = '.env.backup'
    shutil.copyfile('.env', backup_path)
    print(f"Secure backup created at: {backup_path}")

    # 3. Read current .env lines and .env.mumbai values
    with open('.env', 'r', encoding='utf-8') as f:
        env_lines = f.readlines()

    mumbai_env = dotenv_values('.env.mumbai')
    mumbai_db = mumbai_env.get('MUMBAI_DATABASE_URL')
    mumbai_sp_url = mumbai_env.get('MUMBAI_SUPABASE_URL')
    mumbai_anon = mumbai_env.get('MUMBAI_SUPABASE_ANON_KEY')
    mumbai_service = mumbai_env.get('MUMBAI_SUPABASE_SERVICE_ROLE_KEY')
    mumbai_bucket = mumbai_env.get('MUMBAI_STORAGE_BUCKET', 'nutricore-media')

    if not all([mumbai_db, mumbai_sp_url, mumbai_anon, mumbai_service]):
        raise ValueError("One or more required Mumbai settings are missing from .env.mumbai!")

    # 4. Construct updated .env lines
    new_lines = []
    keys_updated = set()
    for line in env_lines:
        trimmed = line.strip()
        if trimmed.startswith('DATABASE_URL='):
            new_lines.append(f"DATABASE_URL={mumbai_db}\n")
            keys_updated.add('DATABASE_URL')
        elif trimmed.startswith('DB_CONN_MAX_AGE='):
            # Set to 60 for local dev performance
            new_lines.append("DB_CONN_MAX_AGE=60\n")
            keys_updated.add('DB_CONN_MAX_AGE')
        elif trimmed.startswith('DISABLE_SERVER_SIDE_CURSORS='):
            new_lines.append("DISABLE_SERVER_SIDE_CURSORS=True\n")
            keys_updated.add('DISABLE_SERVER_SIDE_CURSORS')
        elif trimmed.startswith('SUPABASE_URL='):
            new_lines.append(f"SUPABASE_URL={mumbai_sp_url}\n")
            keys_updated.add('SUPABASE_URL')
        elif trimmed.startswith('SUPABASE_ANON_KEY='):
            new_lines.append(f"SUPABASE_ANON_KEY={mumbai_anon}\n")
            keys_updated.add('SUPABASE_ANON_KEY')
        elif trimmed.startswith('SUPABASE_SERVICE_ROLE_KEY='):
            new_lines.append(f"SUPABASE_SERVICE_ROLE_KEY={mumbai_service}\n")
            keys_updated.add('SUPABASE_SERVICE_ROLE_KEY')
        elif trimmed.startswith('SUPABASE_STORAGE_BUCKET='):
            new_lines.append(f"SUPABASE_STORAGE_BUCKET={mumbai_bucket}\n")
            keys_updated.add('SUPABASE_STORAGE_BUCKET')
        else:
            new_lines.append(line)

    # If SUPABASE_STORAGE_BUCKET wasn't in .env originally, append it
    if 'SUPABASE_STORAGE_BUCKET' not in keys_updated:
        new_lines.append(f"SUPABASE_STORAGE_BUCKET={mumbai_bucket}\n")
        keys_updated.add('SUPABASE_STORAGE_BUCKET')

    # 5. Write back to .env
    with open('.env', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print(f"Updated .env successfully. Keys updated: {sorted(list(keys_updated))}")

if __name__ == '__main__':
    perform_local_cutover()

