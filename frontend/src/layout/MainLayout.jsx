import { useContext, useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, User, Bell, Menu, X, Check, Trash,
  ChevronLeft, LogOut, Settings, Info,
} from 'lucide-react';
import { AuthContext } from '../context/authContext';
import { useWebsocketNotifications } from '../hooks/useWebsocketNotifications';
import sidebarBg from '../assets/sidebar-bg.jpeg';

export default function MainLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const token = localStorage.getItem('access_token');
  const { notifications, unreadCount, markAsRead, removeNotification, markAllAsRead } =
    useWebsocketNotifications(token);

  useEffect(() => {
    const onClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setIsNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setIsProfileOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Close mobile sidebar and reset all overlays when language switches
  useEffect(() => {
    setIsMobileOpen(false);
    setIsNotifOpen(false);
    setIsProfileOpen(false);
  }, [i18n.language]);

  const menu = [
    { name: t('sidebar.dashboard'), path: '/', icon: LayoutDashboard },
    { name: t('sidebar.settings'), path: '/profile', icon: User },
  ];

  const currentTitle = menu.find((m) => m.path === location.pathname)?.name || t('layout.defaultTitle');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 relative">
      {/* Pure CSS Ambient Mesh Gradient Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -start-[10%] w-[50%] h-[50%] rounded-full bg-blue-200/40 blur-[120px]" />
        <div className="absolute top-[20%] -end-[10%] w-[40%] h-[60%] rounded-full bg-sky-200/30 blur-[120px]" />
        <div className="absolute -bottom-[20%] start-[20%] w-[60%] h-[50%] rounded-full bg-indigo-100/50 blur-[120px]" />
      </div>
      
      {/* Ensure the rest of the layout is relative and above the background */}
      <div className="relative z-10 flex h-screen w-full">
        {/* Sidebar */}
        <aside
          className={`
            fixed md:static inset-y-0 start-0 z-50
            backdrop-blur-2xl text-slate-800
            border-e border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]
            flex flex-col overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out
            ${isMobileOpen ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full'} md:ltr:translate-x-0 md:rtl:translate-x-0
            ${isCollapsed ? 'md:w-16' : 'md:w-64'} w-64
          `}
          style={{
            backgroundImage: `url(${sidebarBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundBlendMode: 'overlay',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            opacity: 0.7,
          }}
        >
          {/* ambient top white glow */}
          <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-white/50 via-white/10 to-transparent pointer-events-none" />

          <div className={`relative z-10 h-16 flex items-center border-b border-slate-200/40 ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
            {!isCollapsed && (
              <span className="font-display font-bold text-slate-800">{t('sidebar.brand')}</span>
            )}
            <div className="flex items-center text-slate-500">
              <button
                aria-label={t('layout.closeMenu')}
                className="md:hidden p-2 rounded-md hover:bg-white/60 hover:text-primary transition-colors"
                onClick={() => setIsMobileOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
              <button
                aria-label={t('layout.collapseSidebar')}
                className="hidden md:inline-flex p-2 rounded-md hover:bg-white/60 hover:text-primary transition-colors"
                onClick={() => setIsCollapsed((v) => !v)}
              >
                <ChevronLeft className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          <nav className="flex-1 py-3 px-2 space-y-1">
            {menu.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={`
                    relative z-10 group flex items-center gap-3 h-10 px-3 rounded-[10px] text-sm font-semibold
                    transition-all duration-200
                    ${active
                      ? 'bg-primary/10 text-primary shadow-sm border border-primary/10'
                      : 'text-slate-600 hover:bg-white/60 hover:text-primary'}
                  `}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span>{item.name}</span>}
                  {isCollapsed && (
                    <span className="absolute end-full me-2 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-md whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-200">
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="relative z-10 p-2 border-t border-slate-200/40">
            <Link
              to="/about"
              onClick={() => setIsMobileOpen(false)}
              className="relative group flex items-center gap-3 h-10 px-3 rounded-[10px] text-sm font-semibold
                text-slate-600 hover:bg-white/60 hover:text-primary w-full transition-all duration-200"
            >
              <Info className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>{t('sidebar.about')}</span>}
              {isCollapsed && (
                <span className="absolute end-full me-2 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-md whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-200">
                  {t('sidebar.about')}
                </span>
              )}
            </Link>
          </div>
        </aside>

        {/* Mobile backdrop */}
        {isMobileOpen && (
          <div
            className="md:hidden fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-40"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* Topbar */}
          <header className={`relative h-20 bg-white/40 backdrop-blur-2xl border-b border-white/60 shadow-sm flex items-center justify-between px-6 ${isNotifOpen || isProfileOpen ? 'z-[60]' : 'z-10'}`}>
            <div className="flex items-center gap-3">
              <button
                aria-label={t('layout.openMenu')}
                className={`p-2 -ms-2 rounded-xl text-slate-500 hover:text-primary hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all ${isMobileOpen ? 'hidden' : 'block'} md:hidden`}
                onClick={() => setIsMobileOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
              {location.pathname === '/' ? (
                <h1 
                  onClick={() => window.location.reload()}
                  className="text-xl font-bold text-slate-800 hover:text-primary transition-colors cursor-pointer block"
                  title={t('layout.reloadDashboard')}
                >
                  {currentTitle}
                </h1>
              ) : (
                <h1 className="text-xl font-bold text-slate-800 block">{currentTitle}</h1>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  aria-label={t('layout.notifications')}
                  className={`relative p-2 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 cursor-pointer ${isNotifOpen ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:text-primary hover:bg-white/60'}`}
                  onClick={() => setIsNotifOpen((v) => !v)}
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 end-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-danger rounded-full animate-bounce shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {isNotifOpen && (
                  <div className="fixed top-[75px] start-4 end-4 w-auto sm:absolute sm:top-full sm:mt-3 sm:end-0 sm:start-auto sm:w-96 
                                  bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl rounded-2xl z-50 overflow-hidden 
                                  flex flex-col transform origin-top-right rtl:origin-top-left animate-in fade-in zoom-in-95 duration-200 animate-dropdown">
                    <div className="px-5 py-4 border-b border-white/50 bg-white/30 flex justify-between items-center">
                      <span className="font-semibold text-sm text-slate-800">{t('layout.notifications')}</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {!notifications || notifications.length === 0 ? (
                        <p className="p-6 text-center text-sm font-medium text-gray-400">{t('layout.noNotifications')}</p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-5 border-b border-gray-50 transition-colors ${n.isRead ? 'bg-white opacity-70' : 'bg-primary/5'} flex items-start justify-between gap-2`}
                          >
                            <h4 className={`text-sm font-bold mb-3 ${n.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                              {n.title}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => markAsRead(n.id)}
                                className="text-xs px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg font-bold transition-all"
                                title={t('layout.markAsRead')}
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removeNotification(n.id)}
                                className="text-xs px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg font-bold transition-all"
                                title={t('layout.delete')}
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {notifications?.length > 0 && (
                      <button className="w-full py-3.5 text-sm font-bold text-primary hover:bg-primary/5 transition-colors border-t border-gray-100 text-center bg-gray-50/50" onClick={markAllAsRead}>
                        {t('layout.markAllRead')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="hidden sm:block border-s border-slate-200 h-8 mx-2"></div>

              {/* Profile */}
              <div className="relative" ref={profileRef}>
                <div
                  aria-label={t('layout.profile')}
                  className="flex items-center gap-3 cursor-pointer group hover:bg-white/60 p-1.5 rounded-xl transition-colors"
                  onClick={() => setIsProfileOpen((v) => !v)}
                >
                  <div className="text-start hidden sm:block">
                    <p className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors">
                      {user?.username}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t('sidebar.profileRole')}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-blue-600 group-hover:scale-105 transition-all">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                </div>
                {isProfileOpen && (
                  <div className="absolute end-0 mt-3 w-56 bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl rounded-2xl z-50 overflow-hidden 
                                  flex flex-col transform origin-top-right rtl:origin-top-left animate-in fade-in zoom-in-95 duration-200 animate-dropdown">
                    <div className="px-4 py-3 border-b border-white/50 bg-white/30">
                      <p className="text-sm font-bold text-slate-800 truncate">{user?.username}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5" dir="ltr">{user?.email}</p>
                    </div>
                    <div className="p-1">
                      <Link to="/profile" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-primary rounded-xl transition-colors">
                        <Settings className="w-4 h-4" /> {t('sidebar.settings')}
                      </Link>
                      <button
                        onClick={logout}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors w-full text-end mt-1"
                      >
                        <LogOut className="w-4 h-4" /> {t('layout.logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto p-4 md:p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}