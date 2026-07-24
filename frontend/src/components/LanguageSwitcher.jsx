import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

/**
 * LanguageSwitcher
 * Floating toggle button for switching between Persian (fa/RTL) and English (en/LTR).
 * Positioned absolutely so it sits in the top-end corner of its nearest `relative` ancestor.
 */
export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const isFa = i18n.language === 'fa';

  // Keep document direction and lang attribute in sync with i18n state
  useEffect(() => {
    document.documentElement.dir  = isFa ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language, isFa]);

  const toggle = () => {
    // Close any open mobile sidebar before the direction flip prevents a ghost sidebar
    window.dispatchEvent(new Event('close-mobile-sidebar'));
    i18n.changeLanguage(isFa ? 'en' : 'fa');
  };

  return (
    <button
      dir="ltr"
      onClick={toggle}
      aria-label={isFa ? 'Switch to English' : 'تغییر به فارسی'}
      title={isFa ? 'Switch to English' : 'تغییر به فارسی'}
      className="absolute top-6 end-6 z-50 flex items-center gap-2 px-3.5 py-2 bg-white/60 backdrop-blur-xl border border-white/60 shadow-lg rounded-2xl text-sm font-semibold text-slate-700 hover:bg-white/80 transition-all duration-300 hover:scale-105 select-none"
    >
      <Languages className="w-4 h-4 text-primary flex-shrink-0" />
      <span>{isFa ? 'EN' : 'FA'}</span>
    </button>
  );
}
