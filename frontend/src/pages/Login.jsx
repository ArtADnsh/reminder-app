import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, LogIn } from 'lucide-react';
import { toast } from 'react-toastify';
import { AuthContext } from '../context/authContext';
import axiosInstance from '../api/axiosInstance';
import authBg from '../assets/auth-bg.jpeg';
import LanguageSwitcher from '../components/LanguageSwitcher';

/* ─── helpers ─────────────────────────────────────────────────── */
const BASE_INPUT =
  'w-full h-11 rounded-xl border bg-slate-100/50 ps-4 pe-4 text-[15px] text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-300 disabled:opacity-60 focus:bg-white/80';
const OK_INPUT   = 'border-white/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20';
const ERR_INPUT  = 'border-rose-400/60 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20';

export default function Login() {
  const { t, i18n } = useTranslation();
  const isFa = i18n.language === 'fa';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Per-field errors + a general server error slot
  const [errors, setErrors]       = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login }  = useContext(AuthContext);
  const navigate   = useNavigate();

  /* Clear a single field's error as soon as the user starts typing */
  const clearErr = (field) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));

  const validate = () => {
    const next = {};
    if (!username.trim()) next.username = t('auth.usernameRequired');
    if (!password.trim()) next.password = t('auth.passwordRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;   // stop — inline messages are now shown

    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post('auth/login/', { username, password });
      login(response.data);
      toast.success(
        <div dir={isFa ? 'rtl' : 'ltr'} className="w-full font-medium font-sans">
          {t('auth.welcomeBack', { username: response.data.username })} 👋
        </div>,
        { style: { color: '#0f172a' } }
      );
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.detail || t('auth.loginError');
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 font-sans bg-background overflow-hidden">
      <LanguageSwitcher />

      {/* Decorative background */}
      <img src={authBg} alt="" aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 h-full w-full object-cover opacity-95" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/50" />
      <div className="pointer-events-none absolute -top-40 -end-40 h-[500px] w-[500px] rounded-full bg-blue-500/25 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -start-40 h-[500px] w-[500px] rounded-full bg-indigo-500/20 blur-[120px]" />

      <div className="relative w-full max-w-md">
        <div className="relative bg-white/60 backdrop-blur-2xl border border-white/80 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] rounded-3xl p-8 sm:p-10">

          {/* Brand mark */}
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LogIn className="h-6 w-6" />
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-800">
              {t('auth.loginTitle')}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {t('auth.loginSubtitle')}
            </p>
          </div>

          {/* Server / API error banner */}
          {serverError && (
            <div role="alert"
              className="mb-6 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-center text-sm text-danger animate-dropdown">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* ── Username ── */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('auth.username')}
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                dir="ltr"
                aria-invalid={!!errors.username}
                aria-describedby={errors.username ? 'err-username' : undefined}
                className={`${BASE_INPUT} ${errors.username ? ERR_INPUT : OK_INPUT}`}
                placeholder={t('auth.usernamePlaceholder')}
                value={username}
                onChange={(e) => { setUsername(e.target.value); clearErr('username'); }}
                disabled={isSubmitting}
              />
              {errors.username && (
                <p id="err-username" role="alert"
                  className="text-rose-500 text-xs font-medium mt-1 ms-1 animate-dropdown">
                  {errors.username}
                </p>
              )}
            </div>

            {/* ── Password ── */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'err-password' : undefined}
                className={`${BASE_INPUT} ${errors.password ? ERR_INPUT : OK_INPUT}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearErr('password'); }}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p id="err-password" role="alert"
                  className="text-rose-500 text-xs font-medium mt-1 ms-1 animate-dropdown">
                  {errors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-medium text-[15px] shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{t('auth.loggingIn')}</>
              ) : (
                t('auth.loginButton')
              )}
            </button>
          </form>

          <p className="mt-8 text-sm text-center text-slate-500">
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className="font-medium text-primary hover:text-primary-hover transition-colors">
              {t('auth.signupLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
