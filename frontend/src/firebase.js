// Firebase client initialization for Socially
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// messaging removed

// Your web app's Firebase configuration
const firebaseConfig = {
	apiKey: 'AIzaSyA5h-bF8Ony_TUr1SorI4pmROWpnfcwEAw',
	authDomain: 'socially-843c5.firebaseapp.com',
	projectId: 'socially-843c5',
	storageBucket: 'socially-843c5.firebasestorage.app',
	messagingSenderId: '896178106524',
	appId: '1:896178106524:web:4714914325f866bd1bbd59',
	measurementId: 'G-KY4LKJ2HRK'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics;
try {
	analytics = getAnalytics(app);
} catch (err) {
	// analytics will fail in some environments (SSR, browsers with restricted cookies)
	// it's safe to continue without analytics.
	// console.warn('Firebase analytics init failed:', err);
}

const firestore = getFirestore(app);
const storage = getStorage(app);

// Initialize messaging with proper error handling
// Push messaging disabled per request

/**
 * Request notification permission and return an FCM registration token.
 * Provide your VAPID public key when calling this from the frontend.
 * Returns the current token string, or null if permission not granted / error.
 */
// getFcmToken removed

/**
 * Listen for foreground messages (when app is open).
 * Usage: onMessageListener(payload => { ... })
 */
// onMessageListener removed

export { app, analytics, firestore, storage };

