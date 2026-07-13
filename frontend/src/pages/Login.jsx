import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { toast } from 'react-toastify';
import { AuthContext } from '../context/authContext';
import axiosInstance from '../api/axiosInstance';
import authBg from '../assets/auth-bg.jpeg';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      const msg = 'پر کردن تمامی فیلدها الزامی است.';
      setError(msg);
      toast.warning(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post('auth/login/', { username, password });
      login(response.data);
      toast.success(`خوش آمدی ${response.data.username}! 👋`);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.detail || 'نام کاربری یا رمز عبور اشتباه است.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-10 font-sans bg-background overflow-hidden"
    >
      {/* Concept background */}
      <img
        src={authBg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 h-full w-full object-cover opacity-95"
      />
      {/* Soft wash so the form stays readable */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/50" />
      {/* Top-Right Vibrant Blue Glow */}
      <div className="pointer-events-none absolute -top-40 -end-40 h-[500px] w-[500px] rounded-full bg-blue-500/25 blur-[120px]" />
      {/* Bottom-Left Vibrant Indigo/Purple Glow */}
      <div className="pointer-events-none absolute -bottom-40 -start-40 h-[500px] w-[500px] rounded-full bg-indigo-500/20 blur-[120px]" />

      <div className="relative w-full max-w-md">
        <div className="bg-white/85 backdrop-blur-xl border border-white/60 rounded-[20px] shadow-[0_20px_60px_-20px_rgba(59,130,246,0.25)] p-8 sm:p-10">
          {/* Brand mark */}
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LogIn className="h-6 w-6" />
          </div>

          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              خوش آمدید
            </h1>
            <p className="mt-2 text-sm text-muted">
              برای دسترسی به داشبورد، وارد حساب کاربری خود شوید
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-center text-sm text-danger"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1.5">
                نام کاربری
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                className="w-full h-11 rounded-xl border border-border bg-background px-4 text-[15px] text-foreground placeholder:text-muted outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
                placeholder="شناسه خود را وارد کنید"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                رمز عبور
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="w-full h-11 rounded-xl border border-border bg-background px-4 text-[15px] text-foreground placeholder:text-muted outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-60"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-medium text-[15px] shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال ورود...
                </>
              ) : (
                'ورود به سیستم'
              )}
            </button>
          </form>

          <p className="mt-8 text-sm text-center text-muted">
            حساب کاربری ندارید؟{' '}
            <Link
              to="/signup"
              className="font-medium text-primary hover:text-primary-hover transition-colors"
            >
              ثبت‌نام کنید
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
