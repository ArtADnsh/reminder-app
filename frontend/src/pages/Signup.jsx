import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/authContext';
import axiosInstance from '../api/axiosInstance';
import { toast } from 'react-toastify';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // اعتبارسنجی اولیه در سمت کلاینت
    if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      const msg = 'پر کردن تمامی فیلدها الزامی است.';
      setError(msg);
      toast.warning(msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = 'رمز عبور و تکرار آن با هم مطابقت ندارند.';
      setError(msg);
      toast.warning(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      // ۱. ارسال درخواست ثبت‌نام به بک‌اند جنگو
      await axiosInstance.post('auth/signup/', { username, email, password });

      toast.success('ثبت‌نام با موفقیت انجام شد! در حال ورود...');

      // ۲. لاگین خودکار بلافاصله پس از ثبت‌نام
      const loginRes = await axiosInstance.post('auth/login/', { username, password });
      
      login(loginRes.data); 
      navigate('/');
    } catch (err) {
      let errorMsg = 'خطایی در ثبت‌نام رخ داد. لطفا نام کاربری دیگری امتحان کنید.';
      
      if (err.response && err.response.data) {
        const data = err.response.data;
        if (data.password && data.password.length > 0) {
          errorMsg = data.password[0];
        } else if (data.username && data.username.length > 0) {
          errorMsg = data.username[0];
        } else if (data.email && data.email.length > 0) {
          errorMsg = data.email[0];
        } else if (data.non_field_errors && data.non_field_errors.length > 0) {
          errorMsg = data.non_field_errors[0];
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (typeof data === 'object') {
          const firstKey = Object.keys(data)[0];
          if (firstKey && Array.isArray(data[firstKey])) {
            errorMsg = data[firstKey][0];
          } else if (typeof data[firstKey] === 'string') {
            errorMsg = data[firstKey];
          }
        }
      }
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gray-100">
      <div className="w-full max-w-md p-8 overflow-hidden transition-all bg-white shadow-xl rounded-2xl hover:shadow-2xl">
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-3xl font-bold text-secondary">ثبت‌نام</h2>
          <p className="text-sm text-gray-500">برای ایجاد حساب کاربری جدید، اطلاعات زیر را وارد کنید</p>
        </div>

        {error && (
          <div className="px-4 py-3 mb-6 text-sm text-center text-red-600 border border-red-100 bg-red-50 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block mb-1 text-sm font-semibold text-gray-700">نام کاربری</label>
            <input
              type="text"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white"
              placeholder="یک شناسه یکتا انتخاب کنید"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-gray-700">ایمیل</label>
            <input
              type="email"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-gray-700">رمز عبور</label>
            <input
              type="password"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold text-gray-700">تکرار رمز عبور</label>
            <input
              type="password"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 px-4 mt-2 text-white font-bold rounded-xl shadow-md transition-all duration-300 flex justify-center items-center gap-2 
              ${isSubmitting ? 'bg-primary/70 cursor-not-allowed' : 'bg-primary hover:bg-blue-600 hover:shadow-lg'}`}
          >
            {isSubmitting ? 'در حال ثبت‌نام...' : 'ایجاد حساب کاربری'}
          </button>
        </form>

        {/* دکمه بازگشت به لاگین */}
        <p className="mt-8 text-sm text-center text-gray-600">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <Link to="/login" className="font-bold transition-colors text-primary hover:text-blue-700 hover:underline">
            وارد شوید
          </Link>
        </p>
      </div>
    </div>
  );
}