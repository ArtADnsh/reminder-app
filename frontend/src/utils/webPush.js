import axiosInstance from '../api/axiosInstance';

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const subscribeToWebPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported by this browser.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Push notification permission denied by the user.');
      return null;
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered successfully with scope:', registration.scope);

    await navigator.serviceWorker.ready;

    // ۴. استفاده مستقیم از کلیدی که بالا تعریف کردیم
    const applicationServerKey = urlB64ToUint8Array(vapidPublicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    });

    await axiosInstance.post('webpush/subscribe/', subscription);
    console.log('Successfully bound and persisted web push subscription!');
    
    return subscription;
  } catch (error) {
    console.error('Critical failure during web push subscription process:', error);
    return null;
  }
};