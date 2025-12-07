#!/bin/bash

# Firebase VAPID Key Setup Script
# This script helps you configure Firebase Cloud Messaging with the correct VAPID keys

echo "🔥 Firebase Cloud Messaging VAPID Key Setup"
echo "============================================"
echo ""
echo "To fix the FCM authentication error, you need to:"
echo ""
echo "1. Go to the Firebase Console: https://console.firebase.google.com/"
echo "2. Select your project: socially-843c5"
echo "3. Go to Project Settings > Cloud Messaging"
echo "4. In the 'Web configuration' section, find or generate a 'Web Push certificates' key pair"
echo ""
echo "If you don't have a Web Push certificate:"
echo "  - Click 'Generate key pair'"
echo "  - Copy the generated key"
echo ""
echo "5. Add the VAPID key to your environment:"
echo "   Create a .env file in your frontend directory with:"
echo "   REACT_APP_FIREBASE_VAPID_KEY=YOUR_VAPID_PUBLIC_KEY_HERE"
echo ""
echo "6. Restart your application"
echo ""
echo "Current Firebase project details:"
echo "  Project ID: socially-843c5"
echo "  App ID: 1:896178106524:web:4714914325f866bd1bbd59"
echo "  Sender ID: 896178106524"
echo ""

# Check if .env file exists in frontend
if [ -f "frontend/.env" ]; then
    echo "✅ Found frontend/.env file"
    if grep -q "REACT_APP_FIREBASE_VAPID_KEY" frontend/.env; then
        echo "✅ VAPID key is configured in .env"
    else
        echo "❌ VAPID key not found in .env file"
        echo "Add this line to frontend/.env:"
        echo "REACT_APP_FIREBASE_VAPID_KEY=YOUR_VAPID_PUBLIC_KEY_HERE"
    fi
else
    echo "❌ No .env file found in frontend directory"
    echo "Creating frontend/.env file..."
    cat > frontend/.env << EOF
# Firebase VAPID Key for Push Notifications
# Get this from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
REACT_APP_FIREBASE_VAPID_KEY=YOUR_VAPID_PUBLIC_KEY_HERE

# API Base URL
REACT_APP_API_BASE=http://localhost:3001/api
EOF
    echo "✅ Created frontend/.env file. Please update the VAPID key."
fi

echo ""
echo "After updating the VAPID key, rebuild and restart your app:"
echo "  cd frontend"
echo "  npm run build"
echo "  # Restart your development server"