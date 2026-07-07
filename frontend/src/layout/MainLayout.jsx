import { useContext, useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/authContext';
import { useWebsocketNotifications } from '../hooks/useWebsocketNotifications';

export default function MainLayout() {
  const { user, logout } = useContext(AuthContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();

  const token = localStorage.getItem('access_token');
  const { notifications, unreadCount, markAsRead, removeNotification, markAllAsRead } = useWebsocketNotifications(token);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    { name: 'داشبورد', path: '/', icon: '📊' },
    { name: 'پروفایل من', path: '/profile', icon: '👤' },
    // در آینده مسیرهای جدید را اینجا اضافه می‌کنیم
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">

      {/* ---------------- سایدبار (دسکتاپ و موبایل) ---------------- */}
      <aside
        className={`${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'} 
        md:translate-x-0 fixed md:static inset-y-0 right-0 z-50 w-64 bg-secondary text-white transition-transform duration-300 ease-in-out shadow-2xl flex flex-col`}
      >
        <div className="flex items-center justify-center h-20 border-b border-gray-700">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span>⏳</span> سیستم یادآور
          </h1>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === item.path 
                  ? 'bg-primary text-white shadow-md' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* ---------------- بخش اصلی (هدر + محتوا) ---------------- */}
      <div className="flex-1 flex flex-col w-full">

        {/* هدر بالایی */}
        <header className="h-20 bg-white shadow-sm flex items-center justify-between px-6 z-10">
          {/* دکمه همبرگری برای موبایل */}
          <button
            className="md:hidden text-gray-600 focus:outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>

          <div className="hidden md:block">
            <h2 className="text-xl font-bold text-gray-800">پنل مدیریت</h2>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            
            {/* Notification Bell Container */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`relative p-2 rounded-full transition-colors focus:outline-none cursor-pointer ${isDropdownOpen ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:text-primary hover:bg-gray-100'}`}
                title="اعلانات"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-accent rounded-full animate-bounce shadow-md">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute left-0 sm:right-0 sm:left-auto mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden flex flex-col transform origin-top-left sm:origin-top-right transition-all animate-fade-in">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center">
                    <h3 className="font-extrabold text-gray-800 text-base">اعلانات</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs font-bold bg-primary text-white px-2.5 py-1 rounded-full shadow-sm">{unreadCount} جدید</span>
                    )}
                  </div>
                  
                  <div className="max-h-[350px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                        <span className="text-4xl mb-2 opacity-50">📭</span>
                        <p className="text-sm font-medium">هیچ اعلانی وجود ندارد.</p>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div key={notif.id} className={`p-5 border-b border-gray-50 transition-colors ${notif.isRead ? 'bg-white opacity-70' : 'bg-blue-50/40'}`}>
                          <h4 className={`text-sm font-bold mb-1 ${notif.isRead ? 'text-gray-700' : 'text-gray-900'}`}>{notif.title}</h4>
                          <p className="text-xs text-gray-600 mb-3 leading-relaxed">{notif.description}</p>
                          <div className="flex gap-2 justify-end">
                            {!notif.isRead && (
                              <button onClick={() => markAsRead(notif.id)} className="text-xs px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg font-bold transition-all">
                                ✓ خوانده شد
                              </button>
                            )}
                            <button onClick={() => removeNotification(notif.id)} className="text-xs px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg font-bold transition-all">
                                ✕ حذف
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <button 
                      onClick={() => { markAllAsRead(); setIsDropdownOpen(false); }}
                      className="w-full py-3.5 text-sm font-bold text-primary hover:bg-blue-50 transition-colors border-t border-gray-100 text-center bg-gray-50/50"
                    >
                      خواندن همه اعلانات
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="hidden sm:block border-l border-gray-200 h-8"></div>

            <div className="text-left hidden sm:block">
              <p className="text-sm font-bold text-gray-800">{user?.username}</p>
              <p className="text-xs text-gray-500">کاربر سیستم</p>
            </div>
            <Link to="/profile" className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg shadow-md hover:bg-blue-600 hover:scale-105 transition-all cursor-pointer">
              {user?.username?.charAt(0).toUpperCase()}
            </Link>
            <button
              onClick={logout}
              className="ml-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg text-sm font-bold transition-colors"
            >
              خروج
            </button>
          </div>
        </header>

        {/* محتوای متغیر صفحات (Outlet) */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>

      {/* پس‌زمینه تاریک برای موبایل در زمان باز بودن سایدبار */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}
    </div>
  );
}