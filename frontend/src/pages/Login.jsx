import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axiosInstance from '../api/axiosInstance';
import { toast } from 'react-toastify'; // اضافه شدن Toast

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
      toast.warning(msg); // نمایش اخطار با Toast
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post('auth/login/', { username, password });

      // در کانتکست جدید، کل دیتای دریافتی (توکن‌ها، آیدی، ایمیل و یوزرنیم) را یکجا می‌فرستیم
      login(response.data);

      toast.success(`خوش آمدی ${response.data.username}! 👋`); // پیام موفقیت جذاب
      navigate('/'); // انتقال به داشبورد
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'نام کاربری یا رمز عبور اشتباه است.';
      setError(errorMessage);
      toast.error(errorMessage); // نمایش خطای سرور با Toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden p-8 transition-all hover:shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-secondary mb-2">خوش آمدید</h2>
          <p className="text-gray-500 text-sm">برای دسترسی به داشبورد، وارد حساب کاربری خود شوید</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm text-center border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">نام کاربری</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white"
              placeholder="شناسه خود را وارد کنید"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">رمز عبور</label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-gray-800 bg-gray-50 focus:bg-white"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 px-4 text-white font-bold rounded-lg shadow-md transition-all duration-300 flex justify-center items-center gap-2 
              ${isSubmitting ? 'bg-primary/70 cursor-not-allowed' : 'bg-primary hover:bg-blue-600 hover:shadow-lg'}`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                در حال ورود...
              </>
            ) : (
              'ورود به سیستم'
            )}
          </button>
        </form>

        <p className="mt-8 text-sm text-center text-gray-600">
          حساب کاربری ندارید؟{' '}
          <Link to="/signup" className="font-bold transition-colors text-primary hover:text-blue-700 hover:underline">
            ثبت‌نام کنید
          </Link>
        </p>

      </div>
    </div>
  );
}