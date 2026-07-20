import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'react-toastify';
import { AuthContext } from '../context/authContext';
import axiosInstance from '../api/axiosInstance';
import authBg from '../assets/auth-bg.jpeg';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Signup() {
  const { t, i18n } = useTranslation();
  const isFa = i18n.language === 'fa';

  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]       = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      const msg = t('auth.requiredFields');
      setError(msg); toast.warning(msg); return;
    }
    if (password !== confirmPassword) {
      const msg = t('auth.passwordMismatch');
      setError(msg); toast.warning(msg); return;
    }

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
        if (data.password?.length)            errorMsg = data.password[0];
        else if (data.username?.length)        errorMsg = data.username[0];
        else if (data.email?.length)           errorMsg = data.email[0];
        else if (data.non_field_errors?.length) errorMsg = data.non_field_errors[0];
        else if (data.detail)                  errorMsg = data.detail;
        else if (typeof data === 'object') {
          const k = Object.keys(data)[0];
          if (k && Array.isArray(data[k]))     errorMsg = data[k][0];
          else if (typeof data[k] === 'string') errorMsg = data[k];
        }
      }
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    'w-full h-11 rounded-xl border border-border bg-background ps-4 pe-4 text-[15px] text-foreground placeholder:text-muted outline-none transition-all duration-200 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-60';

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10 font-sans bg-background overflow-hidden">
      {/* Floating language switcher */}
      <LanguageSwitcher />

      {/* Concept background */}
      <img
        src={authBg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 h-full w-full object-cover opacity-95"
      />
      {/* Soft wash so the form stays readable */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/50" />
      {/* Top-end vibrant blue glow */}
      <div className="pointer-events-none absolute -top-40 -end-40 h-[500px] w-[500px] rounded-full bg-blue-500/25 blur-[120px]" />
      {/* Bottom-start vibrant indigo/purple glow */}
      <div className="pointer-events-none absolute -bottom-40 -start-40 h-[500px] w-[500px] rounded-full bg-indigo-500/20 blur-[120px]" />

      <div className="relative w-full max-w-md">
        <div className="bg-white/85 backdrop-blur-xl border border-white/60 rounded-[20px] shadow-[0_20px_60px_-20px_rgba(59,130,246,0.25)] p-8 sm:p-10">

          {/* Brand mark */}
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserPlus className="h-6 w-6" />
          </div>

          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              {t('auth.signupTitle')}
            </h1>
            <p className="mt-2 text-sm text-foreground-soft">
              {t('auth.signupSubtitle')}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="su-username" className="block text-sm font-medium text-foreground mb-1.5">
                {t('auth.username')}
              </label>
              <input
                id="su-username" type="text" autoComplete="username"
                dir="ltr"
                className={fieldClass}
                placeholder={t('auth.signupUsernamePlaceholder')}
                value={username} onChange={(e) => setUsername(e.target.value)} disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="su-email" className="block text-sm font-medium text-foreground mb-1.5">
                {t('auth.email')}
              </label>
              <input
                id="su-email" type="email" autoComplete="email"
                dir="ltr"
                className={fieldClass}
                placeholder="email@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="su-password" className="block text-sm font-medium text-foreground mb-1.5">
                {t('auth.password')}
              </label>
              <input
                id="su-password" type="password" autoComplete="new-password"
                dir="ltr"
                className={fieldClass}
                placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="su-confirm" className="block text-sm font-medium text-foreground mb-1.5">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="su-confirm" type="password" autoComplete="new-password"
                dir="ltr"
                className={fieldClass}
                placeholder="••••••••"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-medium text-[15px] shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('auth.signingUp')}
                </>
              ) : (
                t('auth.signupButton')
              )}
            </button>
          </form>

          <p className="mt-8 text-sm text-center text-muted">
            {t('auth.hasAccount')}{' '}
            <Link
              to="/login"
              className="font-medium text-primary hover:text-primary-hover transition-colors"
            >
              {t('auth.loginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
