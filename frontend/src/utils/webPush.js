import axiosInstance from '../api/axiosInstance';

/**
 * Converts a Base64 URL-safe string into a Uint8Array.
 * Required for cryptographic operations with the PushManager.
 *
 * @param {string} base64String - The Base64 URL-safe VAPID public key.
 * @returns {Uint8Array} The converted binary representation of the key.
 */
const urlB64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Registers the service worker, requests native notification permissions,
 * and securely binds the user's browser session to the web push backend.
 *
 * @returns {Promise<PushSubscription | null>} Returns the subscription object on success, or null on failure/rejection.
 */
export const subscribeToWebPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[WebPush] PushManager or serviceWorker is not supported in this browser.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error('[WebPush] Environment variable VITE_VAPID_PUBLIC_KEY is undefined.');
      return null;
    }

    const applicationServerKey = urlB64ToUint8Array(vapidPublicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    await axiosInstance.post('webpush/subscribe/', subscription);
    
    console.log('[WebPush] Subscription persisted successfully.');
    return subscription;
  } catch (error) {
    console.error('[WebPush] Subscription sequence failed:', error);
    return null;
  }
};