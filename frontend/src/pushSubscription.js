// pushSubscription.js — handles subscribing the browser to Web Push and sending the subscription to the server
async function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function initPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Web Push not supported in this browser');
    return false;
  }

  try {
    // Fetch VAPID public key from server
    const resp = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:3001/api'}/push/vapid-public-key`);
    if (!resp.ok) {
      console.warn('Failed to get VAPID public key');
      return false;
    }
    const { publicKey } = await resp.json();

    // Register service worker
    const swReg = await navigator.serviceWorker.register('/push-service-worker.js');

    // Unsubscribe any existing subscription with a different key
    const existingSub = await swReg.pushManager.getSubscription();
    if (existingSub) {
      await existingSub.unsubscribe();
      console.log('Unsubscribed old push subscription');
    }

    // Subscribe with new key
    const sub = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: await urlBase64ToUint8Array(publicKey)
    });

    // Send subscription to server
    const token = localStorage.getItem('token');
    await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:3001/api'}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ subscription: sub })
    });

    console.log('Push subscription successful');
    return true;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return false;
  }
}

export async function sendTestPush(title, body) {
  const token = localStorage.getItem('token');
  return fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:3001/api'}/push/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify({ title, body })
  });
}

const pushSubscriptionService = { initPushSubscription, sendTestPush };
export default pushSubscriptionService;
