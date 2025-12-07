// FCM Debug and Configuration Utility
// Use this to test and verify your Firebase Cloud Messaging setup

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase config from your project
const firebaseConfig = {
  apiKey: 'AIzaSyA5h-bF8Ony_TUr1SorI4pmROWpnfcwEAw',
  authDomain: 'socially-843c5.firebaseapp.com',
  projectId: 'socially-843c5',
  storageBucket: 'socially-843c5.firebasestorage.app',
  messagingSenderId: '896178106524',
  appId: '1:896178106524:web:4714914325f866bd1bbd59',
  measurementId: 'G-KY4LKJ2HRK'
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

/**
 * Test FCM token generation with different VAPID keys
 */
export async function testFCMToken() {
  console.log('🔥 Testing FCM Token Generation');
  
  // Test with current VAPID key
  const currentVapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY || 'BAkbtHR6tCqMUiBaJGALz6TQTtHqDHNJGC-pvfUvFoXoRH1AY2rSn7Guy0vV-3kNtMEkEfAO3sooaK0VSmy9ja8';
  
  try {
    // Check notification permission
    console.log('📱 Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('Permission status:', permission);
    
    if (permission !== 'granted') {
      console.error('❌ Notification permission denied');
      return null;
    }
    
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('✅ Service worker registered:', registration);
      } catch (swError) {
        console.error('❌ Service worker registration failed:', swError);
      }
    }
    
    // Test token generation
    console.log('🔑 Generating FCM token with VAPID key:', currentVapidKey.substring(0, 20) + '...');
    
    const token = await getToken(messaging, { 
      vapidKey: currentVapidKey 
    });
    
    if (token) {
      console.log('✅ FCM Token generated successfully!');
      console.log('Token:', token);
      return token;
    } else {
      console.error('❌ No registration token available');
      return null;
    }
    
  } catch (error) {
    console.error('❌ FCM Token generation failed:', error);
    
    // Provide specific error guidance
    if (error.code === 'messaging/token-subscribe-failed') {
      console.log('\n🔧 TROUBLESHOOTING STEPS:');
      console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
      console.log('2. Select your project: socially-843c5');
      console.log('3. Go to Project Settings > Cloud Messaging');
      console.log('4. Under "Web configuration", generate a new Web Push certificate');
      console.log('5. Update REACT_APP_FIREBASE_VAPID_KEY in your .env file');
      console.log('6. Clear browser cache and reload');
    }
    
    return null;
  }
}

/**
 * Test message listening
 */
export function setupMessageListener() {
  console.log('👂 Setting up FCM message listener...');
  
  const unsubscribe = onMessage(messaging, (payload) => {
    console.log('📨 Message received:', payload);
    
    // Show notification if possible
    if (payload.notification) {
      const { title, body } = payload.notification;
      if (Notification.permission === 'granted') {
        new Notification(title || 'Socially', {
          body: body || '',
          icon: '/favicon.ico'
        });
      }
    }
  });
  
  return unsubscribe;
}

// Auto-run test when this file is loaded
if (typeof window !== 'undefined') {
  window.testFCM = testFCMToken;
  window.setupFCMListener = setupMessageListener;
  console.log('🛠️ FCM Debug utility loaded. Run testFCM() in console to test.');
}