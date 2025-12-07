# Firebase Cloud Messaging (FCM) Troubleshooting Guide

## The Issue
You're getting a 401 authentication error when trying to register for Firebase Cloud Messaging:
```
POST https://fcmregistrations.googleapis.com/v1/projects/socially-843c5/registrations
Status: 401 - Request is missing required authentication credential
```

## Root Cause
This error typically occurs when:
1. **Invalid VAPID Key**: The VAPID key doesn't match your Firebase project
2. **Missing Web Push Certificate**: No Web Push certificate configured in Firebase Console
3. **Incorrect Firebase Configuration**: Mismatch between client and server configuration

## Solution Steps

### 1. Generate New VAPID Key in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **socially-843c5**
3. Navigate to: **Project Settings** → **Cloud Messaging**
4. Scroll to **Web configuration** section
5. Under **Web Push certificates**:
   - If you see "No certificate", click **Generate key pair**
   - If you see an existing certificate, you can use it or generate a new one
6. Copy the generated key (starts with 'B' and is 88 characters long)

### 2. Update Your Environment Configuration

Update your `frontend/.env` file:
```env
REACT_APP_FIREBASE_VAPID_KEY=YOUR_NEW_VAPID_KEY_HERE
```

### 3. Verify Firebase Project Configuration

Ensure your Firebase project settings match:
- **Project ID**: socially-843c5
- **Sender ID**: 896178106524
- **App ID**: 1:896178106524:web:4714914325f866bd1bbd59

### 4. Test the Configuration

1. Clear browser cache and storage
2. Rebuild your application: `npm run build`
3. Open browser developer tools
4. Navigate to your app
5. Check console for FCM-related messages

### 5. Debug Steps

Run this in your browser console to test FCM:
```javascript
// Test FCM token generation
import('./src/fcm-debug.js').then(module => {
  module.testFCMToken();
});
```

## Additional Checks

### Service Worker Registration
Ensure your service worker is properly registered:
- Check `/firebase-messaging-sw.js` is accessible
- Verify service worker registration in DevTools → Application → Service Workers

### Notification Permissions
- Ensure notification permission is granted
- Check browser settings for site permissions

### Network Issues
- Verify you can reach Firebase servers
- Check for corporate firewalls or proxy issues

## Common VAPID Key Issues

❌ **Wrong**: Using a generic/demo VAPID key
❌ **Wrong**: Using VAPID key from a different Firebase project  
❌ **Wrong**: Using an expired or revoked VAPID key

✅ **Correct**: Using the VAPID key generated specifically for your Firebase project

## Testing Commands

```bash
# Run the VAPID setup helper
./setup-firebase-vapid.sh

# Rebuild the frontend
cd frontend
npm run build

# Check service worker registration
# Open DevTools → Application → Service Workers
```

## If Issues Persist

1. **Regenerate Firebase Web App**:
   - Go to Firebase Console → Project Settings → General
   - Under "Your apps", delete and recreate the web app
   - Update all configuration values

2. **Clear All Browser Data**:
   - Clear cache, cookies, and local storage
   - Try in incognito mode

3. **Verify Firebase Billing**:
   - Ensure your Firebase project has billing enabled (required for FCM)

4. **Check Firebase Status**:
   - Visit [Firebase Status Page](https://status.firebase.google.com/)

## Expected Success Output

After fixing, you should see:
```
✅ Service worker registered
✅ FCM registration token obtained  
✅ FCM token registered successfully
```

Instead of:
```
❌ getFcmToken error FirebaseError: messaging/token-subscribe-failed
```