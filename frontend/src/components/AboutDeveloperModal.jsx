import { useEffect } from 'react';

export default function AboutDeveloperModal({ isOpen, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm" onClick={onClose}>
      
      {/* کارت اصلی مودال */}
      <div 
        className="relative bg-white/60 backdrop-blur-2xl border border-white/80 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-3xl w-full max-w-sm overflow-hidden animate-modal z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* هدر رنگی پشت */}
        <div className="bg-gradient-to-r from-blue-600/80 to-primary/80 h-24 absolute top-0 left-0 right-0 z-0 backdrop-blur-md"></div>
        
        {/* دکمه ضربدر */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-black/10 hover:bg-black/20 text-white rounded-xl transition-colors focus:outline-none cursor-pointer"
          title="بستن"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 pt-12 pb-6 relative z-10 flex flex-col items-center mt-4">
          {/* آواتار */}
          <div className="w-20 h-20 bg-white/90 backdrop-blur-md rounded-full p-1 shadow-lg mb-4 flex items-center justify-center text-4xl border-4 border-white/50">
            👨🏻‍💻
          </div>

          <h3 className="text-xl font-extrabold text-slate-800 mb-1">Arta Danesh</h3>
          <p className="text-sm font-medium text-primary mb-6">توسعه‌دهنده نرم‌افزار</p>

          {/* شبکه لینک‌ها */}
          <div className="w-full grid grid-cols-2 gap-3">
            <a 
              href="https://github.com/ArtADnsh" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-100/50 hover:bg-slate-800 hover:text-white text-slate-700 transition-all border border-white/50 hover:border-slate-800 group shadow-sm hover:shadow-md backdrop-blur-sm"
            >
              <svg className="w-6 h-6 mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              <span className="text-xs font-bold">گیت‌هاب</span>
            </a>

            <a 
              href="https://www.linkedin.com/in/arta-danesh/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-100/50 hover:bg-[#0077b5] hover:text-white text-[#0077b5] transition-all border border-white/50 hover:border-[#0077b5] group shadow-sm hover:shadow-md backdrop-blur-sm"
            >
              <svg className="w-6 h-6 mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              <span className="text-xs font-bold">لینکدین</span>
            </a>

            <a 
              href="https://t.me/ArtA_Dnsh" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-100/50 hover:bg-[#229ED9] hover:text-white text-[#229ED9] transition-all border border-white/50 hover:border-[#229ED9] group shadow-sm hover:shadow-md backdrop-blur-sm"
            >
              <svg className="w-6 h-6 mb-2 pl-1" fill="currentColor" viewBox="0 0 24 24"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.15l-9.49 5.97-4.11-1.28c-.89-.28-.91-.89.19-1.32l16.03-6.18c.74-.27 1.39.16 1.15 1.29l-2.73 12.87c-.2.88-.72 1.1-1.46.68l-4.04-2.98-1.95 1.88c-.21.21-.39.39-.8.39l.27-3.87z"/></svg>
              <span className="text-xs font-bold">تلگرام</span>
            </a>

            <a 
              href="mailto:artadnsh@gmail.com" 
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-100/50 hover:bg-red-500 hover:text-white text-red-500 transition-all border border-white/50 hover:border-red-500 group shadow-sm hover:shadow-md backdrop-blur-sm"
            >
              <svg className="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <span className="text-xs font-bold">ایمیل</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}