# Firebase Configuration Setup

## Service Account Key Setup

The `serviceAccountKey.json` file is **NOT** included in the repository for security reasons. You need to generate your own service account key from the Firebase Console.

### Steps to Generate Your Service Account Key:

1. **Go to Firebase Console**
   - Visit [Firebase Console](https://console.firebase.google.com/)
   - Select your project (e.g., `devskill-fyp`)

2. **Navigate to Service Accounts**
   - Click the ⚙️ Settings icon (top left)
   - Select **Project settings**
   - Go to the **Service accounts** tab

3. **Generate Private Key**
   - Scroll down to the "Firebase Admin SDK" section
   - Click **Generate new private key**
   - Confirm by clicking **Generate key**
   - A JSON file will download automatically

4. **Save the Key File**
   ```bash
   # Rename and move the downloaded file to this directory
   mv ~/Downloads/your-project-xxxxx.json serviceAccountKey.json
   ```

5. **Verify Setup**
   ```bash
   # From the backend directory, run:
   python3 -c "import json; json.load(open('firebase_config/serviceAccountKey.json')); print('✅ Valid service account key')"
   ```

### Security Notes

- **NEVER** commit `serviceAccountKey.json` to git
- This file is already in `.gitignore` to prevent accidental commits
- Keep this file secure and never share it publicly
- Each developer should generate their own key

### Troubleshooting

**Error: "Invalid JWT Signature"**
- Your service account key has expired or been revoked
- Generate a new key following the steps above
- Replace the old `serviceAccountKey.json` with the new one

**Error: "serviceAccountKey.json not found"**
- Make sure you've created the file in this directory
- Check that the filename is exactly `serviceAccountKey.json` (case-sensitive)
