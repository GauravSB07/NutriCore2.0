import os
from PIL import Image

def test_tuning():
    base_dir = r"c:\Users\Gaurav\Downloads\NutriCore Rebuilding\NutriCore2.0\frontend\public\images"
    
    # 1. cheat_img.jpeg (1073x1280)
    p_cheat = os.path.join(base_dir, "cheat_img.jpeg")
    with Image.open(p_cheat) as im:
        print("cheat_img original:", os.path.getsize(p_cheat) / 1024, "KB", im.size)
        # Resize to 512 max dim (6x retina for 80x80)
        im_resized = im.copy()
        im_resized.thumbnail((512, 512), Image.Resampling.LANCZOS)
        out_path = os.path.join(base_dir, "cheat_img_test.webp")
        im_resized.save(out_path, format='WEBP', quality=82, method=6)
        print("cheat_img 512px q=82:", os.path.getsize(out_path) / 1024, "KB", im_resized.size)

    # 2. login.jpg (168x299)
    p_login = os.path.join(base_dir, "login.jpg")
    with Image.open(p_login) as im:
        print("login.jpg original:", os.path.getsize(p_login) / 1024, "KB", im.size)
        for q in [75, 78, 80]:
            out_path = os.path.join(base_dir, f"login_test_{q}.webp")
            im.save(out_path, format='WEBP', quality=q, method=6)
            print(f"login.jpg q={q}:", os.path.getsize(out_path) / 1024, "KB")

    # 3. signup.jpg (225x224)
    p_signup = os.path.join(base_dir, "signup.jpg")
    with Image.open(p_signup) as im:
        print("signup.jpg original:", os.path.getsize(p_signup) / 1024, "KB", im.size)
        for q in [75, 78, 80]:
            out_path = os.path.join(base_dir, f"signup_test_{q}.webp")
            im.save(out_path, format='WEBP', quality=q, method=6)
            print(f"signup.jpg q={q}:", os.path.getsize(out_path) / 1024, "KB")

    # 4. Water_img.jpg (266x190)
    p_water = os.path.join(base_dir, "Water_img.jpg")
    with Image.open(p_water) as im:
        print("Water_img.jpg original:", os.path.getsize(p_water) / 1024, "KB", im.size)
        for q in [75, 78, 80]:
            out_path = os.path.join(base_dir, f"water_test_{q}.webp")
            im.save(out_path, format='WEBP', quality=q, method=6)
            print(f"Water_img.jpg q={q}:", os.path.getsize(out_path) / 1024, "KB")

    # 5. bottle_img.jpg (736x691)
    p_bottle = os.path.join(base_dir, "bottle_img.jpg")
    with Image.open(p_bottle) as im:
        print("bottle_img.jpg original:", os.path.getsize(p_bottle) / 1024, "KB", im.size)
        im_r = im.copy()
        im_r.thumbnail((400, 400), Image.Resampling.LANCZOS)
        out_path = os.path.join(base_dir, "bottle_test.webp")
        im_r.save(out_path, format='WEBP', quality=82, method=6)
        print("bottle_img 400px q=82:", os.path.getsize(out_path) / 1024, "KB", im_r.size)

if __name__ == '__main__':
    test_tuning()
