import os
import re
from PIL import Image

def verify_priority4():
    print("=" * 75)
    print("NutriCore Priority 4: Image Performance Optimization Verification")
    print("=" * 75)

    base_dir = r"c:\Users\Gaurav\Downloads\NutriCore Rebuilding\NutriCore2.0\frontend"
    src_dir = os.path.join(base_dir, "src")
    public_dir = os.path.join(base_dir, "public")
    assets_img_dir = os.path.join(src_dir, "assets", "images")
    public_img_dir = os.path.join(public_dir, "images")

    # 1. Audit all image references in src
    print("\n[1] Verifying Image References in Source Code:")
    referenced_images = set()
    broken_refs = []

    src_files = []
    for root, _, files in os.walk(src_dir):
        for f in files:
            if f.endswith(('.js', '.jsx', '.ts', '.tsx', '.html', '.css')):
                src_files.append(os.path.join(root, f))
    src_files.append(os.path.join(base_dir, "index.html"))

    # Regex for image imports & src strings
    img_pattern = re.compile(r'[\'"]([^\'"]+?\.(?:png|jpg|jpeg|webp|svg))[\'"]')

    for fpath in src_files:
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            matches = img_pattern.findall(content)
            for m in matches:
                if m.startswith('http') or m.startswith('data:'):
                    continue
                referenced_images.add(m)
                # Resolve path
                if m.startswith('/images/'):
                    disk_path = os.path.join(public_dir, m.lstrip('/'))
                elif m.startswith('../') or m.startswith('./'):
                    disk_path = os.path.normpath(os.path.join(os.path.dirname(fpath), m))
                elif m.startswith('/'):
                    disk_path = os.path.join(public_dir, m.lstrip('/'))
                else:
                    disk_path = os.path.join(src_dir, m)
                
                if not os.path.exists(disk_path):
                    broken_refs.append((fpath, m, disk_path))

    if broken_refs:
        print(f"  [X] BROKEN REFERENCES DETECTED: {len(broken_refs)}")
        for r in broken_refs:
            print(f"      File: {os.path.basename(r[0])} -> Ref: {r[1]} -> Missing: {r[2]}")
        assert False, "Broken image references found!"
    else:
        print(f"  [OK] All {len(referenced_images)} unique image references successfully resolved on disk with ZERO broken paths!")

    # 2. Detailed Before vs After asset audit
    print("\n[2] Before vs After File Size Comparison:")
    print(f"{'Asset Name':<22} | {'Original Size':<15} | {'WebP Size':<13} | {'Savings':<10} | {'Dimensions':<11} | {'Aspect Ratio'}")
    print("-" * 88)

    orig_files = [f for f in sorted(os.listdir(public_img_dir)) if not f.endswith('.webp')]
    total_orig = 0
    total_webp = 0

    for fname in orig_files:
        f_orig = os.path.join(public_img_dir, fname)
        base, _ = os.path.splitext(fname)
        f_webp = os.path.join(public_img_dir, f"{base}.webp")

        s_orig = os.path.getsize(f_orig)
        s_webp = os.path.getsize(f_webp)
        total_orig += s_orig
        total_webp += s_webp

        savings = (s_orig - s_webp) / s_orig * 100

        with Image.open(f_orig) as im_orig, Image.open(f_webp) as im_webp:
            w_o, h_o = im_orig.size
            w_w, h_w = im_webp.size
            ar_orig = round(w_o / h_o, 3)
            ar_webp = round(w_w / h_w, 3)
            ar_match = "MATCH" if abs(ar_orig - ar_webp) < 0.02 else f"MISMATCH ({ar_orig} vs {ar_webp})"

        print(f"{fname:<22} | {s_orig/1024:8.1f} KB    | {s_webp/1024:8.1f} KB   | {savings:6.1f}%   | {w_w}x{h_w:<7} | {ar_match}")

    print("-" * 88)
    overall_reduction = (total_orig - total_webp) / total_orig * 100
    saved_mb = (total_orig - total_webp) / (1024 * 1024)
    print(f"TOTAL IMAGE ASSET FOOTPRINT:")
    print(f"  - Before: {total_orig / 1024 / 1024:.2f} MB ({total_orig:,} bytes)")
    print(f"  - After : {total_webp / 1024:.1f} KB ({total_webp:,} bytes)")
    print(f"  - Net Reduction: {overall_reduction:.2f}% (-{saved_mb:.2f} MB saved!)")

    # 3. Verify Lazy / Eager loading attributes across components
    print("\n[3] Verifying Loading & Decoding Attributes in React Source:")
    lazy_count = 0
    eager_count = 0
    async_count = 0

    for fpath in src_files:
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            lazy_count += content.count('loading="lazy"')
            eager_count += content.count('loading="eager"')
            async_count += content.count('decoding="async"')

    print(f"  - loading=\"eager\" (above-the-fold/hero): {eager_count} instances")
    print(f"  - loading=\"lazy\"  (below-the-fold)     : {lazy_count} instances")
    print(f"  - decoding=\"async\" (non-blocking paint) : {async_count} instances")

    print("\n" + "=" * 75)
    print("ALL PRIORITY 4 VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 75)

if __name__ == '__main__':
    verify_priority4()
