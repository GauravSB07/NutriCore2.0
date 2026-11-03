import urllib.request
import os

def test_vite_assets():
    base_url = "http://localhost:5173"
    
    # 1. Test index page
    try:
        with urllib.request.urlopen(f"{base_url}/") as res:
            print(f"GET {base_url}/ -> Status: {res.status}")
    except Exception as e:
        print(f"Error accessing root: {e}")
        return

    # 2. Test each public image asset
    public_dir = r"c:\Users\Gaurav\Downloads\NutriCore Rebuilding\NutriCore2.0\frontend\public\images"
    webp_files = [f for f in os.listdir(public_dir) if f.endswith('.webp')]
    
    print(f"\nTesting {len(webp_files)} WebP assets over HTTP:")
    success = 0
    for w in sorted(webp_files):
        url = f"{base_url}/images/{w}"
        try:
            with urllib.request.urlopen(url) as res:
                content = res.read()
                ct = res.headers.get('Content-Type')
                print(f"  {w:<24} -> HTTP {res.status} | Content-Type: {ct} | Size: {len(content)} bytes")
                if res.status == 200 and len(content) > 0:
                    success += 1
        except Exception as e:
            print(f"  {w:<24} -> FAILED: {e}")
            
    print(f"\nResult: {success}/{len(webp_files)} WebP images verified over HTTP!")
    assert success == len(webp_files), "Not all images returned HTTP 200!"

if __name__ == '__main__':
    test_vite_assets()
