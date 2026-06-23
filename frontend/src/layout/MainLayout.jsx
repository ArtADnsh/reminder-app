import { useContext, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function MainLayout() {
  const { user, logout } = useContext(AuthContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { name: 'داشبورد', path: '/', icon: '📊' },
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

          <div className="flex items-center gap-4">
            <div className="text-left hidden sm:block">
              <p className="text-sm font-bold text-gray-800">{user?.username}</p>
              <p className="text-xs text-gray-500">کاربر سیستم</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg shadow-md">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
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