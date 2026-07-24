import { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, UserPlus, ShieldCheck, RotateCcw, ArrowRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { AuthContext } from '../context/authContext';
import axiosInstance from '../api/axiosInstance';
import authBg from '../assets/auth-bg.jpeg';
import LanguageSwitcher from '../components/LanguageSwitcher';

/* ─── shared style tokens ────────────────────────────────────────── */
const BASE_INPUT =
  'w-full h-11 rounded-xl border bg-slate-100/50 ps-4 pe-4 text-[15px] text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-300 disabled:opacity-60 focus:bg-white/80';
const OK_INPUT  = 'border-white/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20';
const ERR_INPUT = 'border-rose-400/60 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20';

const OTP_LENGTH  = 6;
const TIMER_START = 120; // seconds

/* ─── utility ────────────────────────────────────────────────────── */
const fmtTimer = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/* ════════════════════════════════════════════════════════════════════
   STEP 2 — OTP verification panel
   ════════════════════════════════════════════════════════════════════ */
function OtpStep({ registeredEmail, registeredUsername, onBack }) {
  const { t, i18n } = useTranslation();
  const isFa = i18n.language === 'fa';

  const { login }  = useContext(AuthContext);
  const navigate   = useNavigate();

  // 6 individual digit slots stored as an array
  const [digits,      setDigits]      = useState(Array(OTP_LENGTH).fill(''));
  const [otpError,    setOtpError]    = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timer,       setTimer]       = useState(TIMER_START);

  // One ref per digit box — order is always 0→5 (logical, not visual)
  const inputRefs = useRef(Array.from({ length: OTP_LENGTH }, () => null));

  /* ── countdown ── */
  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  /* ── focus first box on mount ── */
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  /* ── combine digits into a string ── */
  const otp = digits.join('');

  /* ── verify ── */
  const handleVerify = useCallback(async (overrideOtp) => {
    const code = overrideOtp ?? otp;
    if (code.length < OTP_LENGTH) {
      setOtpError(t('auth.otpIncomplete'));
      return;
    }
    setOtpError('');
    setIsVerifying(true);
    try {
      const res = await axiosInstance.post('auth/verify-otp/', {
        email: registeredEmail,
        otp: code,
      });
      login(res.data);
      toast.success(
        <div dir={isFa ? 'rtl' : 'ltr'} className="w-full font-medium font-sans">
          {t('auth.otpVerifySuccess')}
        </div>,
        { style: { color: '#0f172a' } }
      );
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.detail || t('auth.otpInvalid');
      setOtpError(msg);
      toast.error(msg);
      // Clear boxes and re-focus first on error
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setIsVerifying(false);
    }
  }, [otp, registeredEmail, login, navigate, t, isFa]);

  /* ── resend ── */
  const handleResend = async () => {
    setIsResending(true);
    try {
      await axiosInstance.post('auth/resend-otp/', { email: registeredEmail });
      setTimer(TIMER_START);
      setDigits(Array(OTP_LENGTH).fill(''));
      setOtpError('');
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      toast.success(
        <div dir={isFa ? 'rtl' : 'ltr'} className="w-full font-medium font-sans">
          {t('auth.otpResent')}
        </div>,
        { style: { color: '#0f172a' } }
      );
    } catch (err) {
      const msg = err.response?.data?.detail || t('auth.otpResendError');
      toast.error(msg);
    } finally {
      setIsResending(false);
    }
  };

  /* ── digit input handler ── */
  const handleDigitChange = (idx, value) => {
    // Accept only a single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    setOtpError('');

    // Auto-advance
    if (digit && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }

    // Auto-submit when last digit is entered
    if (digit && idx === OTP_LENGTH - 1) {
      handleVerify(next.join(''));
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        // Clear current
        const next = [...digits];
        next[idx] = '';
        setDigits(next);
      } else if (idx > 0) {
        // Move to previous and clear it
        const next = [...digits];
        next[idx - 1] = '';
        setDigits(next);
        inputRefs.current[idx - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft') inputRefs.current[Math.max(0, idx - 1)]?.focus();
    if (e.key === 'ArrowRight') inputRefs.current[Math.min(OTP_LENGTH - 1, idx + 1)]?.focus();
  };

  /* ── paste support ── */
  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!text) return;
    const next = Array(OTP_LENGTH).fill('');
    text.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    setOtpError('');
    const focusIdx = Math.min(text.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
    if (text.length === OTP_LENGTH) handleVerify(text);
  };

  const canResend = timer === 0 && !isResending;

  return (
    <div className="animate-modal">
      {/* Icon */}
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ShieldCheck className="h-7 w-7" />
      </div>

      {/* Heading */}
      <div className="text-center mb-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-800">
          {t('auth.otpTitle')}
        </h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {t('auth.otpSubtitle')}
        </p>
        <p className="mt-1 text-sm font-semibold text-primary truncate">
          {registeredEmail}
        </p>
      </div>

      {/* OTP error banner */}
      {otpError && (
        <div role="alert"
          className="mt-5 rounded-xl border border-rose-400/20 bg-rose-50/60 px-4 py-3 text-center text-sm text-rose-600 animate-dropdown">
          {otpError}
        </div>
      )}

      {/* 6-digit boxes — always LTR in layout, RTL only flips visual order which is intentional */}
      <div dir="ltr" className="flex justify-center gap-2 sm:gap-3 mt-6">
        {digits.map((d, idx) => (
          <input
            key={idx}
            ref={(el) => { inputRefs.current[idx] = el; }}
            id={`otp-${idx}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            aria-label={`${t('auth.otpDigit')} ${idx + 1}`}
            className="w-12 h-14 text-center text-xl font-bold bg-slate-100/50 border border-white/50 text-slate-800 rounded-xl focus:bg-white/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-50 caret-transparent"
            style={otpError ? { borderColor: 'rgba(251,113,133,0.6)' } : {}}
            disabled={isVerifying}
            onChange={(e) => handleDigitChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={idx === 0 ? handlePaste : undefined}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>

      {/* Verify button */}
      <button
        onClick={() => handleVerify()}
        disabled={isVerifying || otp.length < OTP_LENGTH}
        className="mt-6 w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-medium text-[15px] shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/25 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isVerifying ? (
          <><Loader2 className="h-4 w-4 animate-spin" />{t('auth.otpVerifying')}</>
        ) : (
          t('auth.otpVerifyBtn')
        )}
      </button>

      {/* Timer + resend row */}
      <div className="mt-5 flex flex-col items-center gap-2">
        {timer > 0 && (
          <p className="text-sm text-slate-500">
            {t('auth.otpExpires')}{' '}
            <span className="font-mono font-semibold text-slate-700">{fmtTimer(timer)}</span>
          </p>
        )}
        <button
          onClick={handleResend}
          disabled={!canResend}
          className={`inline-flex items-center gap-1.5 text-sm font-medium transition-all duration-200
            ${canResend
              ? 'text-primary hover:text-primary-hover'
              : 'text-slate-400 opacity-50 cursor-not-allowed'
            }`}
        >
          <RotateCcw className={`h-3.5 w-3.5 ${isResending ? 'animate-spin' : ''}`} />
          {t('auth.otpResendBtn')}
        </button>
      </div>

      {/* Back link */}
      <button
        onClick={onBack}
        className="mt-6 w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <ArrowRight className="h-3 w-3 rotate-180" />
        {t('auth.otpBack')}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   STEP 1 — Registration form
   ════════════════════════════════════════════════════════════════════ */
function SignupStep({ onSuccess }) {
  const { t, i18n } = useTranslation();
  const isFa = i18n.language === 'fa';

  const [username,        setUsername]        = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors,          setErrors]          = useState({});
  const [serverError,     setServerError]     = useState('');
  const [isSubmitting,    setIsSubmitting]    = useState(false);

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
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await axiosInstance.post('auth/signup/', { username, email, password });
      toast.success(
        <div dir={isFa ? 'rtl' : 'ltr'} className="w-full font-medium font-sans">
          {t('auth.otpSent')}
        </div>,
        { style: { color: '#0f172a' } }
      );
      // Hand off to parent — carries registered credentials
      onSuccess({ email, username });
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
    <>
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
            className={`${BASE_INPUT} ${errors.username ? ERR_INPUT : OK_INPUT} text-right`}
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
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
   ROOT — orchestrates step transitions
   ════════════════════════════════════════════════════════════════════ */
export default function Signup() {
  const [step,              setStep]              = useState(1);
  const [registeredEmail,   setRegisteredEmail]   = useState('');
  const [registeredUsername, setRegisteredUsername] = useState('');

  const handleSignupSuccess = ({ email, username }) => {
    setRegisteredEmail(email);
    setRegisteredUsername(username);
    setStep(2);
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
        {/* Glass card — shared across both steps */}
        <div className="relative bg-white/60 backdrop-blur-2xl border border-white/80 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] rounded-3xl p-8 sm:p-10 overflow-hidden">

          {/* Step indicator dots */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2].map((s) => (
              <div key={s}
                className={`h-1.5 rounded-full transition-all duration-500
                  ${s === step ? 'w-8 bg-primary' : 'w-3 bg-slate-300'}`}
              />
            ))}
          </div>

          {step === 1 ? (
            <SignupStep onSuccess={handleSignupSuccess} />
          ) : (
            <OtpStep
              registeredEmail={registeredEmail}
              registeredUsername={registeredUsername}
              onBack={() => setStep(1)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
