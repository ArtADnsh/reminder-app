import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, UserPlus } from 'lucide-react';
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

export default function Signup() {
  const { t, i18n } = useTranslation();
  const isFa = i18n.language === 'fa';

  const [username,         setUsername]         = useState('');
  const [email,            setEmail]            = useState('');
  const [password,         setPassword]         = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');

  // Per-field errors + a general server error slot
  const [errors,       setErrors]       = useState({});
  const [serverError,  setServerError]  = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login }  = useContext(AuthContext);
  const navigate   = useNavigate();

  /* Clear a single field's error as soon as the user starts typing */
  const clearErr = (field) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));

  const validate = () => {
    const next = {};
    if (!username.trim())        next.username        = t('auth.usernameRequired');
    if (!email.trim())           next.email           = t('auth.emailRequired');
    if (!password.trim())        next.password        = t('auth.passwordRequired');
    if (!confirmPassword.trim()) next.confirmPassword = t('auth.confirmPasswordRequired');
    else if (password !== confirmPassword)
                                 next.confirmPassword = t('auth.passwordMismatch');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;   // stop — inline messages are now shown

    setIsSubmitting(true);
    try {
      await axiosInstance.post('auth/signup/', { username, email, password });
      toast.success(
        <div dir={isFa ? 'rtl' : 'ltr'} className="w-full font-medium font-sans">
          {t('auth.signupSuccess')}
        </div>,
        { style: { color: '#0f172a' } }
      );
      const loginRes = await axiosInstance.post('auth/login/', { username, password });
      login(loginRes.data);
      navigate('/');
    } catch (err) {
      let errorMsg = t('auth.signupError');
      if (err.response?.data) {
        const data = err.response.data;
        if (data.password?.length)             errorMsg = data.password[0];
        else if (data.username?.length)         errorMsg = data.username[0];
        else if (data.email?.length)            errorMsg = data.email[0];
        else if (data.non_field_errors?.length) errorMsg = data.non_field_errors[0];
        else if (data.detail)                   errorMsg = data.detail;
        else if (typeof data === 'object') {
          const k = Object.keys(data)[0];
          if (k && Array.isArray(data[k]))      errorMsg = data[k][0];
          else if (typeof data[k] === 'string') errorMsg = data[k];
        }
      }
      setServerError(errorMsg);
      toast.error(errorMsg);
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
            <UserPlus className="h-6 w-6" />
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-800">
              {t('auth.signupTitle')}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {t('auth.signupSubtitle')}
            </p>
          </div>

          {/* Server / API error banner */}
          {serverError && (
            <div role="alert"
              className="mb-6 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-center text-sm text-danger animate-dropdown">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* ── Username ── */}
            <div>
              <label htmlFor="su-username" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('auth.username')}
              </label>
              <input
                id="su-username" type="text" autoComplete="username" dir="ltr"
                aria-invalid={!!errors.username}
                aria-describedby={errors.username ? 'err-su-username' : undefined}
                className={`${BASE_INPUT} ${errors.username ? ERR_INPUT : OK_INPUT}`}
                placeholder={t('auth.signupUsernamePlaceholder')}
                value={username}
                onChange={(e) => { setUsername(e.target.value); clearErr('username'); }}
                disabled={isSubmitting}
              />
              {errors.username && (
                <p id="err-su-username" role="alert"
                  className="text-rose-500 text-xs font-medium mt-1 ms-1 animate-dropdown">
                  {errors.username}
                </p>
              )}
            </div>

            {/* ── Email ── */}
            <div>
              <label htmlFor="su-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('auth.email')}
              </label>
              <input
                id="su-email" type="email" autoComplete="email" dir="ltr"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'err-su-email' : undefined}
                className={`${BASE_INPUT} ${errors.email ? ERR_INPUT : OK_INPUT}`}
                placeholder="email@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearErr('email'); }}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p id="err-su-email" role="alert"
                  className="text-rose-500 text-xs font-medium mt-1 ms-1 animate-dropdown">
                  {errors.email}
                </p>
              )}
            </div>

            {/* ── Password ── */}
            <div>
              <label htmlFor="su-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('auth.password')}
              </label>
              <input
                id="su-password" type="password" autoComplete="new-password" dir="ltr"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'err-su-password' : undefined}
                className={`${BASE_INPUT} ${errors.password ? ERR_INPUT : OK_INPUT}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearErr('password'); }}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p id="err-su-password" role="alert"
                  className="text-rose-500 text-xs font-medium mt-1 ms-1 animate-dropdown">
                  {errors.password}
                </p>
              )}
            </div>

            {/* ── Confirm Password ── */}
            <div>
              <label htmlFor="su-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="su-confirm" type="password" autoComplete="new-password" dir="ltr"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'err-su-confirm' : undefined}
                className={`${BASE_INPUT} ${errors.confirmPassword ? ERR_INPUT : OK_INPUT}`}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearErr('confirmPassword'); }}
                disabled={isSubmitting}
              />
              {errors.confirmPassword && (
                <p id="err-su-confirm" role="alert"
                  className="text-rose-500 text-xs font-medium mt-1 ms-1 animate-dropdown">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-medium text-[15px] shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{t('auth.signingUp')}</>
              ) : (
                t('auth.signupButton')
              )}
            </button>
          </form>

          <p className="mt-8 text-sm text-center text-slate-500">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="font-medium text-primary hover:text-primary-hover transition-colors">
              {t('auth.loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
