import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_login(email, password):
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        return resp.json()["access_token"]
    print(f"Login failed for {email}: {resp.status_code} {resp.text}")
    return None

def test_get_devices(token):
    resp = requests.get(f"{BASE_URL}/devices", headers={"Authorization": f"Bearer {token}"})
    if resp.status_code == 200:
        devices = resp.json()
        print(f"Got {len(devices)} devices")
        for d in devices:
            print(f" - {d['id']}: {d['pack_name']}")
        return devices
    print(f"Get devices failed: {resp.status_code} {resp.text}")
    return []

if __name__ == "__main__":
    print("Testing Admin User:")
    admin_token = test_login("admin@bms.local", "admin123")
    if admin_token:
        test_get_devices(admin_token)
        
    print("\nTesting Standard User:")
    user_token = test_login("user@bms.local", "user123")
    if user_token:
        test_get_devices(user_token)
