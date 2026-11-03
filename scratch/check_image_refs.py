import os
import re

base_dir = r"c:\Users\Gaurav\Downloads\NutriCore Rebuilding\NutriCore2.0\frontend\src"
images_dir = r"c:\Users\Gaurav\Downloads\NutriCore Rebuilding\NutriCore2.0\frontend\src\assets\images"
image_files = sorted(os.listdir(images_dir))

src_files = []
for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith(('.js', '.jsx', '.ts', '.tsx', '.html', '.css')):
            src_files.append(os.path.join(root, f))

# Also check index.html
src_files.append(r"c:\Users\Gaurav\Downloads\NutriCore Rebuilding\NutriCore2.0\frontend\index.html")

print(f"Total source files searched: {len(src_files)}")
print(f"{'Image File':<25} | {'References Count':<18} | {'Where Referenced'}")
print("-" * 80)

for img in image_files:
    refs = []
    # search by filename
    for s_path in src_files:
        with open(s_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            if img in content:
                rel = os.path.relpath(s_path, os.path.dirname(base_dir))
                refs.append(rel)
    print(f"{img:<25} | {len(refs):<18} | {', '.join(refs) if refs else 'UNREFERENCED'}")
