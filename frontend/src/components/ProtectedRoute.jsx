import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/authContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  // تا زمانی که وضعیت چک شدن کاربر مشخص نشده، یک لودینگ ساده نشان می‌دهیم
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-gray-500">در حال بررسی اطلاعات...</span>
      </div>
    );
  }

  // اگر کاربری وجود نداشت، او را به صفحه ورود هدایت کن
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // اگر لاگین بود، اجازه بده کامپوننت فرزند (مثلا داشبورد) رندر شود
  return children;
};

export default ProtectedRoute;