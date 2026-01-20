# Firestore Security Rules Deployment Guide

## What Changed

Your old rules allowed **anyone** to read/write your database until December 24, 2025. The new rules implement proper security:

### New Security Features

1. **Users Collection**
   - Users can read their own user document (fixes the permission error!)
   - Admins can read all user documents
   - Users cannot change their own role
   - Only admins can delete users

2. **Role-Based Access Control**
   - Admins have broader access across collections
   - Regular users can only access their own data

3. **Protected Collections**
   - Sessions: User-specific read/write, admin can read all
   - Quests: All users can read, only admins can modify
   - Submissions: Users can manage their own, admins can see all

4. **Default Deny**
   - Any collection not explicitly defined is denied by default

---

## How to Deploy (2 Methods)

### Method 1: Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com/project/devskill-fyp/firestore/rules)

2. Copy the contents of `firestore.rules` file

3. Paste into the rules editor

4. Click **"Publish"**

5. Wait for confirmation message

---

### Method 2: Firebase CLI (Recommended for Version Control)

#### Step 1: Install Firebase CLI (if not already installed)
```bash
npm install -g firebase-tools
```

#### Step 2: Login to Firebase
```bash
firebase login
```

#### Step 3: Initialize Firebase in your project (if not done)
```bash
cd /home/user/FYP
firebase init firestore
```
- Select your project: `devskill-fyp`
- Use existing `firestore.rules` file when prompted
- Press Enter for default `firestore.indexes.json`

#### Step 4: Deploy the rules
```bash
firebase deploy --only firestore:rules
```

You should see:
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/devskill-fyp/overview
```

---

## Verify Deployment

After deploying, test your app:

1. **Login Test**
   - Try logging in with a user account
   - You should NO LONGER see: `"Missing or insufficient permissions"`
   - User role should load correctly

2. **Check Console**
   - Go to Firebase Console > Firestore > Rules tab
   - Verify the new rules are showing with helper functions

3. **Browser Console**
   - Check browser console - the Firebase permission error should be gone
   - You should see "Login successful!" only once now

---

## Important Notes

⚠️ **After deploying these rules, you must ensure:**

1. **Every user document has a `role` field** set to either `'admin'` or `'student'`
   - Check existing users in Firestore
   - Update any users missing the role field

2. **New user registration must include `role` field**
   - Your `Register.jsx` should already be doing this
   - Verify in your registration code

3. **Session data must include `userId` field**
   - Any session documents must have `userId: <user_uid>`

---

## Troubleshooting

### If you still get permission errors:

**Error:** "Missing or insufficient permissions"
- **Cause:** Rules not deployed or user document missing `role` field
- **Fix:** Re-deploy rules and check user document structure

**Error:** "User document doesn't exist"
- **Cause:** User authenticated but no Firestore document created
- **Fix:** Ensure registration process creates user document in `users` collection

**Error:** "Cannot read role"
- **Cause:** User document missing `role` field
- **Fix:** Manually add `role: 'student'` or `role: 'admin'` to user documents

---

## Next Steps

After deploying rules:
1. ✅ Fix the Firestore permission error
2. 🔄 Update any existing user documents to include `role` field
3. 🧪 Test login flow with different user roles
4. 📊 Verify admin dashboard can access all users
5. 🔒 Consider adding more granular rules as your app grows

---

## File Location

The rules file is saved at: `/home/user/FYP/firestore.rules`

Keep this file in version control so you can track changes and deploy consistently.
