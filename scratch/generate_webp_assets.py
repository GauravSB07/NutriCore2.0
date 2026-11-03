import os
from PIL import Image

def generate_optimized_assets():
    base_dir = r"c:\Users\Gaurav\Downloads\NutriCore Rebuilding\NutriCore2.0\frontend"
    target_dirs = [
        os.path.join(base_dir, "public", "images"),
        os.path.join(base_dir, "src", "assets", "images"),
    ]

    print("=== Generating High-Performance WebP Assets ===")
    
    for tdir in target_dirs:
        print(f"\n--- Directory: {tdir} ---")
        files = sorted(os.listdir(tdir))
        for fname in files:
            if fname.endswith(('.webp', '.svg')):
                continue
            fpath = os.path.join(tdir, fname)
            if not os.path.isfile(fpath):
                continue

            base_name, ext = os.path.splitext(fname)
            webp_name = f"{base_name}.webp"
            webp_path = os.path.join(tdir, webp_name)

            orig_size = os.path.getsize(fpath)

            with Image.open(fpath) as im:
                has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
                
                # Custom optimizations based on asset role
                im_to_save = im.copy()
                
                if fname.lower() == 'cheat_img.jpeg':
                    # Container is 80x80 px. 512 max dim gives >6x retina density
                    im_to_save.thumbnail((512, 512), Image.Resampling.LANCZOS)
                    im_to_save.save(webp_path, format='WEBP', quality=82, method=6)
                elif fname.lower() == 'bottle_img.jpg':
                    # Container is 56x56 px. 400 max dim gives >7x retina density
                    im_to_save.thumbnail((400, 400), Image.Resampling.LANCZOS)
                    im_to_save.save(webp_path, format='WEBP', quality=82, method=6)
                elif fname.lower() in ('login.jpg', 'signup.jpg', 'water_img.jpg'):
                    im_to_save.save(webp_path, format='WEBP', quality=78, method=6)
                elif fname.lower() == 'welcome.jpg':
                    # High quality 85 preserves crisp details while dropping from 1MB to 41KB
                    im_to_save.save(webp_path, format='WEBP', quality=85, method=6)
                elif has_alpha:
                    im_to_save.save(webp_path, format='WEBP', quality=88, method=6)
                else:
                    im_to_save.save(webp_path, format='WEBP', quality=85, method=6)
                
                new_size = os.path.getsize(webp_path)
                savings = (orig_size - new_size) / orig_size * 100
                print(f"  {fname:<20} ({orig_size/1024:6.1f} KB) -> {webp_name:<20} ({new_size/1024:6.1f} KB) | Saved: {savings:5.1f}%")

if __name__ == '__main__':
    generate_optimized_assets()
