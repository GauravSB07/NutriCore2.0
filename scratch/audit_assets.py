import os
import hashlib
from PIL import Image

def get_hash(path):
    with open(path, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

def audit_directory(dir_path):
    print(f"\n--- Auditing: {dir_path} ---")
    files = sorted(os.listdir(dir_path))
    total_size = 0
    records = []
    for fname in files:
        fpath = os.path.join(dir_path, fname)
        if not os.path.isfile(fpath):
            continue
        size = os.path.getsize(fpath)
        total_size += size
        md5 = get_hash(fpath)
        try:
            with Image.open(fpath) as img:
                w, h = img.size
                fmt = img.format
                mode = img.mode
        except Exception as e:
            w, h, fmt, mode = ('?', '?', '?', '?')
        
        records.append({
            'name': fname,
            'size': size,
            'size_kb': size / 1024,
            'dims': f"{w}x{h}",
            'fmt': fmt,
            'mode': mode,
            'md5': md5
        })
    
    records.sort(key=lambda r: r['size'], reverse=True)
    for r in records:
        print(f"{r['name']:<22} | {r['size_kb']:8.1f} KB | {r['dims']:<11} | Fmt: {r['fmt']:<5} | Mode: {r['mode']:<5} | MD5: {r['md5'][:8]}")
    print(f"Total Size: {total_size / 1024 / 1024:.2f} MB ({total_size:,} bytes) in {len(records)} files")
    return records

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_img = os.path.join(base_dir, 'frontend', 'public', 'images')
    src_img = os.path.join(base_dir, 'frontend', 'src', 'assets', 'images')
    r1 = audit_directory(public_img)
    r2 = audit_directory(src_img)
