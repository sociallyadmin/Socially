// Firebase Messaging service worker for Socially
// v2025-12-06: force update with skipWaiting/clients.claim
// Uses the compat libraries to receive background messages.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Same config as frontend/src/firebase.js
const firebaseConfig = {
  apiKey: 'AIzaSyA5h-bF8Ony_TUr1SorI4pmROWpnfcwEAw',
  authDomain: 'socially-843c5.firebaseapp.com',
  projectId: 'socially-843c5',
  storageBucket: 'socially-843c5.firebasestorage.app',
  messagingSenderId: '896178106524',
  appId: '1:896178106524:web:4714914325f866bd1bbd59',
  measurementId: 'G-KY4LKJ2HRK'
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notification = payload.notification || {};
  const title = notification.title || 'Socially';
  const options = {
    body: notification.body || '',
    icon: notification.icon || '/favicon.ico'
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('activate', (event) => {
  console.log('Firebase messaging service worker active');
  self.skipWaiting();
  self.clients.claim();
});

