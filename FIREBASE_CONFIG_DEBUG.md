# 🔧 Firebase Configuration Verification

## Current Configuration Issues

**SenderId Mismatch Error**: The VAPID key doesn't match your Firebase project's sender ID.

Current settings:
- Project ID: `socially-843c5`
- Sender ID: `896178106524` 
- VAPID Key: `BD0cRmR6LY5J2VUowTCGDt42tucxYigT40gVRPdd_KmC3GTWrbtIRaGwB7yeN6Ps6R1VL8OdkEBTLq-JN1qU8L8`

## Required Actions

### 1. Verify Firebase Project
Go to Firebase Console and confirm:
- You're in the correct project: `socially-843c5`
- The sender ID matches: `896178106524`

### 2. Enable Firebase Cloud Messaging API
1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Select project: `socially-843c5`
3. Go to "APIs & Services" → "Library" 
4. Search for "Firebase Cloud Messaging API"
5. Click "Enable" if not already enabled

### 3. Regenerate Web Push Certificate
1. Go back to Firebase Console → Project Settings → Cloud Messaging
2. **Delete** the existing Web Push certificate (if any)
3. Click **"Generate key pair"** to create a new one
4. **IMPORTANT**: Make sure you're in the `socially-843c5` project when doing this
5. Copy the new VAPID public key

### 4. Alternative: Check Project Mismatch
The VAPID key you provided might be from a different Firebase project. Double-check:
- Are you looking at the correct Firebase project?
- Do you have multiple Firebase projects?
- Is the Web Push certificate generated from the `socially-843c5` project specifically?

## Next Steps
Once you get the correct VAPID key from the right project:
1. Update the VAPID key in your environment
2. Rebuild and redeploy
3. Test FCM registration

The "SenderId mismatch" error will be resolved when the VAPID key matches your Firebase project's sender ID.