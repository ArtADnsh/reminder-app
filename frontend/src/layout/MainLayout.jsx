import { useContext, useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, User, Bell, Menu, X, Check, Trash,
  ChevronLeft, LogOut, Settings, Info,
} from 'lucide-react';
import { AuthContext } from '../context/authContext';
import { useWebsocketNotifications } from '../hooks/useWebsocketNotifications';

export default function MainLayout() {
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

  const menu = [
    { name: 'داشبورد', path: '/', icon: LayoutDashboard },
    { name: 'تنظیمات', path: '/profile', icon: User },
  ];

  const currentTitle = menu.find((m) => m.path === location.pathname)?.name || 'یادآور';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 right-0 z-50 bg-surface border-l border-border
          flex flex-col transition-transform duration-300 md:transition-all
          ${isMobileOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0
          ${isCollapsed ? 'md:w-16' : 'md:w-64'} w-64
        `}
      >
        <div className={`h-16 flex items-center border-b border-border ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
          {!isCollapsed && (
            <span className="font-display font-semibold text-foreground">⏳ Task reminder</span>
          )}
          <div className="flex items-center">
            <button
              aria-label="بستن منو"
              className="md:hidden p-2 rounded-md hover:bg-surface-2"
              onClick={() => setIsMobileOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <button
              aria-label="جمع کردن سایدبار"
              className="hidden md:inline-flex p-2 rounded-md hover:bg-surface-2"
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
                  relative group flex items-center gap-3 h-10 px-3 rounded-[10px] text-sm font-medium
                  transition-colors duration-150
                  ${active
                    ? 'bg-primary-soft text-primary'
                    : 'text-foreground-soft hover:bg-surface-2 hover:text-foreground'}
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
                {isCollapsed && (
                  <span className="absolute end-full me-2 hidden group-hover:block bg-foreground text-background text-xs px-2 py-1 rounded shadow-md whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-200">
                    {item.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border">
          <Link
            to="/about"
            onClick={() => setIsMobileOpen(false)}
            className="relative group flex items-center gap-3 h-10 px-3 rounded-[10px] text-sm font-medium
              text-foreground-soft hover:bg-surface-2 hover:text-foreground w-full transition-colors"
          >
            <Info className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span>درباره ما</span>}
            {isCollapsed && (
              <span className="absolute end-full me-2 hidden group-hover:block bg-foreground text-background text-xs px-2 py-1 rounded shadow-md whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-200">
                درباره ما
              </span>
            )}
          </Link>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-surface border-b border-border">
          <div className="flex items-center gap-3">
            <button
              aria-label="باز کردن منو"
              className="md:hidden p-2 rounded-md hover:bg-surface-2"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            {location.pathname === '/' ? (
              <h1 
                onClick={() => window.location.reload()}
                className="font-display font-semibold text-lg text-foreground cursor-pointer hover:text-primary transition-colors"
                title="بارگذاری مجدد داشبورد"
              >
                {currentTitle}
              </h1>
            ) : (
              <h1 className="font-display font-semibold text-lg text-foreground">{currentTitle}</h1>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                aria-label="اعلانها"
                className="relative p-2 rounded-md hover:bg-surface-2"
                onClick={() => setIsNotifOpen((v) => !v)}
              >
                <Bell className="w-5 h-5 text-foreground-soft" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 start-1 w-2 h-2 rounded-full bg-danger" />
                )}
              </button>
              {isNotifOpen && (
                <div className="absolute end-0 mt-2 w-80 bg-surface rounded-[14px] border border-border shadow-lg z-50 overflow-hidden">
                  <div className="p-3 flex items-center justify-between border-b border-border">
                    <span className="font-semibold text-sm">اعلانها</span>
                    {notifications?.length > 0 && (
                      <button className="text-xs text-primary transition-colors hover:text-primary-hover" onClick={markAllAsRead}>
                        علامتگذاری همه
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {!notifications || notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted">اعلانی نداری</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="p-3 border-b border-border last:border-0 hover:bg-surface-2 flex items-start justify-between gap-2"
                        >
                          <div className={`text-sm ${n.isRead ? 'text-muted' : 'text-foreground font-medium'}`}>
                            {n.title}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => markAsRead(n.id)}
                              className="p-1 text-muted hover:text-green-500 transition-colors"
                              title="خوانده شد"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeNotification(n.id)}
                              className="p-1 text-muted hover:text-red-500 transition-colors"
                              title="حذف"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-6 bg-border mx-2"></div>

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                aria-label="پروفایل"
                className="flex items-center gap-2 h-10 px-2 rounded-[10px] hover:bg-surface-2"
                onClick={() => setIsProfileOpen((v) => !v)}
              >
                <span className="text-sm font-medium text-foreground hidden sm:block">{user?.username}</span>
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
              </button>
              {isProfileOpen && (
                <div className="absolute end-0 mt-2 w-56 bg-surface rounded-[14px] border border-border shadow-lg z-50 overflow-hidden">
                  <div className="p-3 border-b border-border">
                    <div className="text-sm font-semibold">{user?.username}</div>
                    <div className="text-xs text-muted">{user?.email}</div>
                  </div>
                  <Link to="/profile" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2">
                    <Settings className="w-4 h-4" /> تنظیمات
                  </Link>
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger hover:bg-danger-soft"
                  >
                    <LogOut className="w-4 h-4" /> خروج
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}