# Google OAuth Setup Guide

## Overview
This guide walks you through setting up Google OAuth sign-in/sign-up for Socially. Users can now register and login using their Google accounts instead of email/password.

## What Was Implemented

### Backend
- **POST `/api/auth/google`** - Exchanges Google ID token for JWT
  - Accepts Google ID token from frontend
  - Verifies token with Google OAuth2Client
  - Creates new user if email doesn't exist
  - Returns JWT token for authentication
  - Automatically marks Google users as verified (their email is already verified by Google)

### Frontend
- **GoogleLoginButton Component** - Reusable Google Sign-In button
  - Integrates Google's official Sign-In SDK
  - Exchanges token for backend JWT
  - Handles both login and signup flows
  - Added to Login.js and Register.js pages
  - Displays with "or" separator between Google and email/password options

## Setup Steps

### Step 1: Create OAuth 2.0 Credentials in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the "Google+ API":
   - Click "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"
4. Create OAuth 2.0 Client ID:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add Authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - `https://yourdomain.com` (production)
   - Add Authorized redirect URIs:
     - `http://localhost:3000` (development)
     - `https://yourdomain.com` (production)
   - Click "Create"
   - Copy the **Client ID**

### Step 2: Configure Environment Variables

**Frontend - `frontend/.env`** (create if doesn't exist):
```
REACT_APP_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
REACT_APP_API_BASE=http://localhost:5000/api
```

**Backend - `backend/.env`** (update existing):
```
PORT=5000
JWT_SECRET=your_jwt_secret_here
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
RESEND_API_KEY=your_resend_key_here
```

### Step 3: Reinstall Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### Step 4: Test Locally

1. Start backend:
   ```bash
   cd backend
   npm run dev
   ```

2. In another terminal, start frontend:
   ```bash
   cd frontend
   npm start
   ```

3. Navigate to http://localhost:3000/login or http://localhost:3000/register
4. You should see a "Sign in with Google" button
5. Click it and authenticate with your Google account
6. You should be automatically logged in and redirected to the home page

## How It Works

1. **User clicks "Sign in with Google"**
   - Google Sign-In SDK prompts user to select Google account
   
2. **Frontend exchanges token**
   - Receives Google ID token
   - Sends token to `/api/auth/google` endpoint
   
3. **Backend verifies and creates user**
   - Verifies token signature with Google's public keys
   - Extracts email, name, profile picture
   - Finds existing user or creates new one
   - Stores googleId for future reference
   
4. **Backend returns JWT**
   - Creates JWT token signed with JWT_SECRET
   - Frontend stores token in localStorage
   - User is logged in and redirected to home

## Database Changes

Google OAuth users have these fields set automatically:
- `googleId` - Google's unique identifier for the user
- `verified` - Set to `true` (Google emails are verified)
- `avatar` - Profile picture from Google account (if available)
- `username` - Defaults to email prefix if not provided by Google

## User Model Addition

The user object now includes:
```javascript
{
  id: "uuid",
  username: "string",
  email: "string",
  password: null, // OAuth users have no password
  avatar: "string|null", // Profile picture from Google
  bio: "",
  googleId: "string", // Google's unique ID
  verified: true, // Always true for Google users
  createdAt: "ISO timestamp",
  followers: [],
  following: [],
  friends: []
}
```

## Production Deployment

When deploying to production:

1. **Add production domain to Google Cloud Console**
   - Go back to OAuth credentials
   - Edit the Web application
   - Add your production domain to both authorized origins and redirect URIs
   - Example: `https://socially.example.com`

2. **Update environment variables**
   - Set `REACT_APP_GOOGLE_CLIENT_ID` on frontend hosting
   - Set `GOOGLE_CLIENT_ID` on backend hosting

3. **Update HTTPS**
   - Google OAuth requires HTTPS in production
   - Ensure your frontend and backend are served over HTTPS

## Security Notes

- ✅ Google ID tokens are verified server-side before user creation
- ✅ JWT tokens are signed with your JWT_SECRET (keep it secret!)
- ✅ OAuth users with no password cannot reset password (they must use Google)
- ✅ No sensitive data from Google is stored (only email, name, picture)

## Troubleshooting

**Issue: "Google is not defined"**
- The Google Sign-In SDK failed to load
- Check browser console for CSP errors
- Verify `REACT_APP_GOOGLE_CLIENT_ID` is set correctly

**Issue: "Invalid Google token"**
- Backend verification failed
- Check that `GOOGLE_CLIENT_ID` matches the frontend client ID
- Verify token wasn't expired

**Issue: "CORS error"**
- Backend API not reachable from frontend
- Check `REACT_APP_API_BASE` environment variable
- Ensure backend CORS is configured properly

**Issue: New users not created**
- Check backend logs for errors
- Verify database write permissions
- Check that uuid is imported correctly

## Next Steps

- Users can now sign up via Google
- Consider adding Google Sign-In to mobile app
- Set up email notifications for Google OAuth signups
- Monitor for duplicate accounts if users sign up with both email and Google
