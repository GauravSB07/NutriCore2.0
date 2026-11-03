import os
from PIL import Image

def optimize_images():
    base_dir = r"c:\Users\Gaurav\Downloads\NutriCore Rebuilding\NutriCore2.0\frontend"
    dirs = [
        os.path.join(base_dir, "public", "images"),
        os.path.join(base_dir, "src", "assets", "images"),
    ]

    for d in dirs:
        print(f"\nProcessing directory: {d}")
        files = sorted(os.listdir(d))
        for fname in files:
            # Only process original images
            if fname.endswith(('.webp', '.svg')):
                continue
            src_path = os.path.join(d, fname)
            if not os.path.isfile(src_path):
                continue
            
            base_name, ext = os.path.splitext(fname)
            webp_name = f"{base_name}.webp"
            webp_path = os.path.join(d, webp_name)
            
            with Image.open(src_path) as im:
                orig_size = os.path.getsize(src_path)
                has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
                
                # Determine quality & settings
                # If RGBA, save with lossless or high-quality lossy preserving alpha
                if fname.lower().startswith('welcome'):
                    # welcome is 1024x920, displayed at 256x256. We keep original dimensions or high-res 1024
                    im.save(webp_path, format='WEBP', quality=85, method=6)
                elif has_alpha:
                    im.save(webp_path, format='WEBP', quality=88, method=6)
                else:
                    im.save(webp_path, format='WEBP', quality=85, method=6)
                
                new_size = os.path.getsize(webp_path)
                savings = (orig_size - new_size) / orig_size * 100
                print(f"  {fname:<20} ({orig_size/1024:6.1f}KB) -> {webp_name:<20} ({new_size/1024:6.1f}KB) | -{savings:5.1f}%")

if __name__ == '__main__':
    optimize_images()
