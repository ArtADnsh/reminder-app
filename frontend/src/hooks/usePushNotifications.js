/**
 * usePushNotifications
 *
 * مدیریت کامل چرخه‌ی Push Notification:
 *  1. بررسی پشتیبانی مرورگر
 *  2. دریافت وضعیت فعلی مجوز
 *  3. درخواست مجوز (فقط از طریق رویداد کاربری)
 *  4. ثبت PushSubscription با VAPID Key
 *  5. ارسال subscription به بک‌اند
 */

import { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../api/axiosInstance';

// VAPID Public Key از متغیر محیطی Vite خوانده می‌شود
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * تبدیل VAPID Public Key از فرمت Base64 URL به Uint8Array
 * که توسط API استاندارد PushManager مورد نیاز است.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * ارسال اطلاعات subscription به بک‌اند جنگو
 */
async function sendSubscriptionToServer(subscription) {
  const subscriptionJson = subscription.toJSON();
  await axiosInstance.post('push/subscribe/', {
    endpoint: subscriptionJson.endpoint,
    p256dh: subscriptionJson.keys?.p256dh,
    auth: subscriptionJson.keys?.auth,
  });
}

/**
 * حذف subscription از بک‌اند
 */
async function deleteSubscriptionFromServer(endpoint) {
  await axiosInstance.post('push/unsubscribe/', { endpoint });
}

export function usePushNotifications() {
  // وضعیت‌های ممکن: 'unsupported' | 'default' | 'granted' | 'denied' | 'loading' | 'error'
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);

  // بررسی پشتیبانی مرورگر و وضعیت اولیه
  useEffect(() => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);

    if (!supported) {
      setPermission('unsupported');
      return;
    }

    // وضعیت فعلی مجوز را بخوان
    setPermission(Notification.permission);

    // بررسی اینکه آیا subscription فعال هست
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setIsSubscribed(!!subscription);
      })
      .catch((err) => {
        console.error('[Push] Error checking subscription status:', err);
      });
  }, []);

  /**
   * درخواست مجوز و ثبت Push Subscription
   * این تابع باید حتماً از طریق رویداد کلیک کاربر فراخوانی شود.
   */
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('مرورگر شما از Push Notification پشتیبانی نمی‌کند.');
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error('[Push] VITE_VAPID_PUBLIC_KEY is not set in .env file.');
      setError('پیکربندی Push Notification ناقص است.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // درخواست مجوز از کاربر — این باید پشت رویداد کلیک باشد
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        setIsLoading(false);
        return;
      }

      // دریافت Service Worker فعال
      const registration = await navigator.serviceWorker.ready;

      // ثبت Push Subscription با VAPID Key
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // ارسال subscription به بک‌اند
      await sendSubscriptionToServer(subscription);

      setIsSubscribed(true);
      console.info('[Push] Successfully subscribed to push notifications.');
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
      setError('خطا در فعال‌سازی Push Notification. لطفاً دوباره تلاش کنید.');
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  /**
   * لغو Push Subscription
   */
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // اطلاع‌رسانی به بک‌اند برای حذف subscription
        await deleteSubscriptionFromServer(subscription.endpoint);
        // لغو subscription در مرورگر
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      console.info('[Push] Successfully unsubscribed from push notifications.');
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
      setError('خطا در لغو Push Notification.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  };
}
