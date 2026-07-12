import React from 'react';

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Section 1: About the App */}
      <section className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-2 h-full bg-primary"></div>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-50 text-primary p-3 rounded-2xl">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-800">درباره سیستم یادآور</h2>
        </div>
        
        <p className="text-gray-600 mb-8 leading-relaxed text-lg">
          این سیستم یک ابزار قدرتمند برای مدیریت زمان و کارهای شماست. با استفاده از این اپلیکیشن، دیگر هیچ کار مهمی را فراموش نخواهید کرد. هدف ما ارائه یک تجربه کاربری سریع، زیبا و کارآمد است.
        </p>

        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          ✨ ویژگی‌های کلیدی
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all group">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-right">🎯</div>
            <h4 className="text-lg font-bold text-gray-800 mb-2">مدیریت هوشمند تسک‌ها</h4>
            <p className="text-gray-500 text-sm leading-relaxed">تسک‌های خود را با دسته‌بندی‌های رنگارنگ و شخصی‌سازی‌شده به راحتی مدیریت کنید.</p>
          </div>
          
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all group">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-right">🔁</div>
            <h4 className="text-lg font-bold text-gray-800 mb-2">تسک‌های دوره‌ای</h4>
            <p className="text-gray-500 text-sm leading-relaxed">امکان تعریف عادات و روتین‌های روزانه، هفتگی و ماهانه برای برنامه‌ریزی دقیق‌تر.</p>
          </div>
          
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all group">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-right">🔔</div>
            <h4 className="text-lg font-bold text-gray-800 mb-2">سیستم اعلانات زنده</h4>
            <p className="text-gray-500 text-sm leading-relaxed">دریافت ناتیفیکیشن‌های آنی در مرورگر و تلگرام برای اینکه هیچ کاری از قلم نیفتد.</p>
          </div>
        </div>
      </section>

      {/* Section 2: Developer Profile */}
      <section className="bg-gradient-to-br from-gray-900 to-secondary rounded-3xl p-8 sm:p-10 shadow-lg text-white relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-primary opacity-20 rounded-full -ml-10 -mb-10 blur-2xl"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex flex-col items-center md:items-start text-center md:text-right">
            <h3 className="text-lg font-medium text-gray-400 mb-2">توسعه‌دهنده</h3>
            <h2 className="text-4xl font-extrabold mb-2 tracking-tight">Arta Danesh</h2>
            <p className="text-primary font-bold text-xl mb-6">Software Engineer</p>
            <p className="text-gray-300 max-w-md leading-relaxed text-sm">
              طراح و توسعه‌دهنده این پلتفرم. علاقه‌مند به ساخت رابط‌های کاربری مدرن و توسعه سیستم‌های کارآمد و مقیاس‌پذیر.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
            <a 
              href="https://github.com/ArtaDnsh" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/10 hover:bg-white text-white hover:text-gray-900 transition-all border border-white/10 hover:border-white shadow-sm hover:shadow-lg group"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              <span className="font-bold">گیت‌هاب</span>
            </a>

            <a 
              href="https://linkedin.com/in/arta-danesh" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/10 hover:bg-[#0077b5] text-white transition-all border border-white/10 hover:border-[#0077b5] shadow-sm hover:shadow-lg group"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              <span className="font-bold">لینکدین</span>
            </a>

            <a 
              href="https://t.me/ArtaDanesh" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/10 hover:bg-[#229ED9] text-white transition-all border border-white/10 hover:border-[#229ED9] shadow-sm hover:shadow-lg group"
            >
              <svg className="w-6 h-6 pl-1" fill="currentColor" viewBox="0 0 24 24"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.15l-9.49 5.97-4.11-1.28c-.89-.28-.91-.89.19-1.32l16.03-6.18c.74-.27 1.39.16 1.15 1.29l-2.73 12.87c-.2.88-.72 1.1-1.46.68l-4.04-2.98-1.95 1.88c-.21.21-.39.39-.8.39l.27-3.87z"/></svg>
              <span className="font-bold">تلگرام</span>
            </a>

            <a 
              href="mailto:arta.danesh.99@gmail.com" 
              className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/10 hover:bg-red-500 text-white transition-all border border-white/10 hover:border-red-500 shadow-sm hover:shadow-lg group"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <span className="font-bold">ایمیل</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
