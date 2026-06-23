import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from "./pages/Signup.jsx";
import Dashboard from './pages/Dashboard';
import MainLayout from './layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>

        {/* مسیرهای عمومی */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

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
        </Route>

        {/* مدیریت خطای 404 - هدایت خودکار کاربر به داشبورد */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}

export default App;