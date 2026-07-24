/**
 * PushNotificationButton
 *
 * کامپوننت دکمه‌ای برای مدیریت Push Notification.
 * - نمایش وضعیت فعلی (فعال / غیرفعال / بلاک‌شده)
 * - درخواست مجوز فقط از طریق کلیک کاربر (رعایت سیاست مرورگرها)
 * - اتصال به hook مرکزی usePushNotifications
 */

import { usePushNotifications } from '../hooks/usePushNotifications';

export function PushNotificationButton() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  // اگر مرورگر پشتیبانی نمی‌کند، چیزی نشان نده
  if (!isSupported) return null;

  // اگر کاربر قبلاً بلاک کرده
  if (permission === 'denied') {
    return (
      <div className="push-notification-blocked">
        <span className="push-icon">🔕</span>
        <span className="push-label">
          اعلان‌ها بلاک شده‌اند. لطفاً از تنظیمات مرورگر آن را فعال کنید.
        </span>
      </div>
    );
  }

  const handleClick = () => {
    if (isSubscribed) {
      unsubscribe();
    } else {
      // این تنها نقطه‌ای است که Notification.requestPermission فراخوانی می‌شود
      // و به‌طور مستقیم داخل یک event handler کاربر قرار دارد
      subscribe();
    }
  };

  return (
    <div className="push-notification-wrapper">
      <button
        id="push-notification-toggle-btn"
        className={`push-notification-btn ${isSubscribed ? 'push-active' : 'push-inactive'} ${isLoading ? 'push-loading' : ''}`}
        onClick={handleClick}
        disabled={isLoading}
        aria-label={isSubscribed ? 'لغو اعلان‌های Push' : 'فعال‌سازی اعلان‌های Push'}
        title={isSubscribed ? 'اعلان‌های Push فعال است — کلیک کنید تا غیرفعال شود' : 'برای دریافت اعلان‌ها کلیک کنید'}
      >
        {isLoading ? (
          <span className="push-spinner" aria-hidden="true" />
        ) : (
          <span className="push-icon" aria-hidden="true">
            {isSubscribed ? '🔔' : '🔕'}
          </span>
        )}
        <span className="push-label">
          {isLoading
            ? 'در حال پردازش...'
            : isSubscribed
            ? 'اعلان‌ها فعال است'
            : 'فعال‌سازی اعلان‌ها'}
        </span>
      </button>

      {error && (
        <p className="push-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default PushNotificationButton;
