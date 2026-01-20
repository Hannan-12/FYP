#!/usr/bin/env python3
"""
Setup verification script for test simulation
Checks if all requirements are met before running the simulation
"""

import os
import sys
import json

def check_firebase_credentials():
    """Check if Firebase service account key exists and is valid"""
    cred_path = "firebase_config/serviceAccountKey.json"

    print("1️⃣  Checking Firebase credentials...")

    if not os.path.exists(cred_path):
        print(f"   ❌ File not found: {cred_path}")
        print(f"   📝 Please add your serviceAccountKey.json file")
        print(f"   📚 See SIMULATION_SETUP.md for instructions")
        return False

    try:
        with open(cred_path, 'r') as f:
            data = json.load(f)

        required_fields = ['type', 'project_id', 'private_key', 'client_email']
        missing = [field for field in required_fields if field not in data]

        if missing:
            print(f"   ❌ Invalid credentials file - missing fields: {missing}")
            return False

        if data.get('project_id') == 'your-project-id':
            print(f"   ⚠️  Credentials file contains example values")
            print(f"   📝 Please use your actual Firebase credentials")
            return False

        print(f"   ✅ Credentials file found and valid")
        print(f"   📦 Project ID: {data.get('project_id')}")
        return True

    except json.JSONDecodeError:
        print(f"   ❌ Invalid JSON in credentials file")
        return False
    except Exception as e:
        print(f"   ❌ Error reading credentials: {e}")
        return False

def check_dependencies():
    """Check if required Python packages are installed"""
    print("\n2️⃣  Checking Python dependencies...")

    required_packages = [
        ('requests', 'requests'),
        ('fastapi', 'fastapi'),
        ('firebase_admin', 'firebase-admin'),
        ('pydantic', 'pydantic')
    ]

    missing = []

    for package_import, package_name in required_packages:
        try:
            __import__(package_import)
        except ImportError:
            missing.append(package_name)

    if missing:
        print(f"   ❌ Missing packages: {', '.join(missing)}")
        print(f"   📝 Install with: pip install -r requirements.txt")
        return False

    print(f"   ✅ All required packages installed")
    return True

def check_backend_connectivity():
    """Check if backend server is running"""
    print("\n3️⃣  Checking backend server...")

    try:
        import requests
        response = requests.get("http://127.0.0.1:8000/docs", timeout=2)
        print(f"   ✅ Backend is running (Status: {response.status_code})")
        return True
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Backend not running")
        print(f"   📝 Start with: python3 main.py")
        return False
    except Exception as e:
        print(f"   ⚠️  Cannot connect to backend: {e}")
        return False

def check_simulation_script():
    """Check if simulation script exists"""
    print("\n4️⃣  Checking simulation script...")

    script_path = "test_simulation_student.py"

    if not os.path.exists(script_path):
        print(f"   ❌ Simulation script not found: {script_path}")
        return False

    if not os.access(script_path, os.X_OK):
        print(f"   ⚠️  Script not executable, making it executable...")
        os.chmod(script_path, 0o755)

    print(f"   ✅ Simulation script ready")
    return True

def main():
    print("=" * 60)
    print("🔍 Test Simulation Setup Verification")
    print("=" * 60)
    print()

    checks = [
        ("Firebase Credentials", check_firebase_credentials),
        ("Python Dependencies", check_dependencies),
        ("Backend Server", check_backend_connectivity),
        ("Simulation Script", check_simulation_script)
    ]

    results = {}
    for name, check_func in checks:
        results[name] = check_func()

    print("\n" + "=" * 60)
    print("📊 Summary")
    print("=" * 60)

    all_passed = all(results.values())

    for name, passed in results.items():
        status = "✅" if passed else "❌"
        print(f"{status} {name}")

    print()

    if all_passed:
        print("🎉 All checks passed! You're ready to run the simulation.")
        print()
        print("Run the simulation with:")
        print("   python3 test_simulation_student.py")
        print()
        print("Or with custom number of sessions:")
        print("   python3 test_simulation_student.py 5")
        return 0
    else:
        print("⚠️  Some checks failed. Please fix the issues above.")
        print()
        print("📚 See SIMULATION_SETUP.md for detailed instructions")
        return 1

if __name__ == "__main__":
    sys.exit(main())
