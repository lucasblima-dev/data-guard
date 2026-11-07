import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent

for svc in ["analysis-service", "data-quality-service", "intelligence-service"]:
    svc_path = str(root / "services" / svc)
    sys.path.insert(0, svc_path)
    try:
        mod = __import__("app.main", fromlist=["app"])
        print(f"[OK] {svc}: loaded app successfully!")
    except Exception as e:
        print(f"[FAIL] {svc}: {e}")
    finally:
        sys.path.remove(svc_path)
        # remove imported app module from cache to avoid collisions
        for key in list(sys.modules.keys()):
            if key == "app" or key.startswith("app."):
                del sys.modules[key]
