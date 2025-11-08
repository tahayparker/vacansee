# \scripts\setup_credentials.py

"""
Helper script for setting up authentication credentials locally.
For Windows, uses DPAPI for encryption. For other systems, uses a keyring library.
This script is for LOCAL development only. GitHub Actions uses repository secrets.
"""

import os
import sys
import getpass
from pathlib import Path

# Try to import Windows-specific DPAPI
try:
    import win32crypt
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

# Try to import keyring for cross-platform support
try:
    import keyring
    HAS_KEYRING = True
except ImportError:
    HAS_KEYRING = False


def encrypt_windows(data: str) -> bytes:
    """Encrypt data using Windows DPAPI."""
    if not HAS_WIN32:
        raise RuntimeError("win32crypt not available. Install pywin32: pip install pywin32")
    
    return win32crypt.CryptProtectData(data.encode('utf-8'), None, None, None, None, 0)


def decrypt_windows(encrypted_data: bytes) -> str:
    """Decrypt data using Windows DPAPI."""
    if not HAS_WIN32:
        raise RuntimeError("win32crypt not available. Install pywin32: pip install pywin32")
    
    _, decrypted = win32crypt.CryptUnprotectData(encrypted_data, None, None, None, 0)
    return decrypted.decode('utf-8')


def store_credential_keyring(service: str, username: str, password: str):
    """Store credential using keyring library."""
    if not HAS_KEYRING:
        raise RuntimeError("keyring not available. Install it: pip install keyring")
    
    keyring.set_password(service, username, password)


def get_credential_keyring(service: str, username: str) -> str:
    """Retrieve credential using keyring library."""
    if not HAS_KEYRING:
        raise RuntimeError("keyring not available. Install it: pip install keyring")
    
    return keyring.get_password(service, username)


def setup_credentials():
    """Interactive setup for credentials."""
    print("=== UOWD Timetable Scraper - Credential Setup ===\n")
    print("This script will help you securely store your credentials.")
    print("Credentials will be stored in environment variables or encrypted storage.\n")
    
    # Determine platform
    is_windows = sys.platform.startswith('win')
    
    print(f"Detected platform: {'Windows' if is_windows else 'Unix-like'}\n")
    
    # Get credentials from user
    email = input("Enter your UOWD email: ").strip()
    password = getpass.getpass("Enter your UOWD password: ")
    totp_secret = getpass.getpass("Enter your TOTP secret (from authenticator app setup): ")
    
    if not email or not password or not totp_secret:
        print("\nError: All fields are required!")
        sys.exit(1)
    
    # Create .env file for local development
    env_path = Path(__file__).parent.parent / ".env.local"
    
    print(f"\nStoring credentials in: {env_path}")
    
    with open(env_path, "a", encoding="utf-8") as f:
        # Check if variables already exist
        env_content = env_path.read_text() if env_path.exists() else ""
        
        if "UOWD_EMAIL" not in env_content:
            f.write(f"\n# UOWD Authentication\n")
            f.write(f"UOWD_EMAIL={email}\n")
        
        if "UOWD_PASSWORD" not in env_content:
            f.write(f"UOWD_PASSWORD={password}\n")
        
        if "UOWD_TOTP_SECRET" not in env_content:
            f.write(f"UOWD_TOTP_SECRET={totp_secret}\n")
    
    print("\n✓ Credentials stored successfully!")
    print(f"\nIMPORTANT SECURITY NOTES:")
    print(f"1. .env.local should be in .gitignore (verify this!)")
    print(f"2. NEVER commit credentials to version control")
    print(f"3. For production, use GitHub Secrets:")
    print(f"   - UOWD_EMAIL")
    print(f"   - UOWD_PASSWORD")
    print(f"   - UOWD_TOTP_SECRET")
    
    # Verify .gitignore
    gitignore_path = Path(__file__).parent.parent / ".gitignore"
    if gitignore_path.exists():
        gitignore_content = gitignore_path.read_text()
        if ".env.local" not in gitignore_content:
            print(f"\n⚠ WARNING: .env.local is NOT in .gitignore!")
            print(f"   Add it immediately to prevent credential leaks!")
        else:
            print(f"\n✓ .env.local is properly ignored by git")
    
    print("\n=== Setup Complete ===")
    print(f"\nYou can now run the authenticated scraper:")
    print(f"  python scripts/scrape_timetable_auth.py --output public/classes.csv")
    print(f"\nFor debugging (see browser window):")
    print(f"  python scripts/scrape_timetable_auth.py --output public/classes.csv --no-headless")


def main():
    """Main entry point."""
    try:
        setup_credentials()
    except KeyboardInterrupt:
        print("\n\nSetup cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nError during setup: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
