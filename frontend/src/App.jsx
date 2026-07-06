import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from "./pages/Signup.jsx";
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import MainLayout from './layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';

function App() {
  return (
    <Router>
      <Routes>

        {/* مسیرهای عمومی — فقط برای مهمان */}
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />

        {/* مسیرهای محافظت‌شده (Private Routes)
          هر صفحه‌ای که داخل این بلاک باشد، ابتدا توکن آن چک می‌شود
          و سپس در قالب MainLayout (همراه با هدر و سایدبار) رندر می‌شود.
        */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          {/* Outlet Component: وقتی آدرس دقیقاً / باشد، Dashboard رندر می‌شود */}
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* مدیریت خطای 404 - هدایت خودکار کاربر به داشبورد */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}

export default App;