import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastContainer, Slide } from 'react-toastify'; 
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

// ── Service Worker Registration ──────────────────────────────────────────────
// ثبت Service Worker پس از لود کامل صفحه انجام می‌شود تا با رندر اولیه
// رقابت نکند. خطاها به‌صورت آرام log می‌شوند تا برنامه هیچ‌گاه خراب نشود.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.info('[SW] Service Worker registered successfully. Scope:', registration.scope);
      })
      .catch((error) => {
        console.error('[SW] Service Worker registration failed:', error);
      });
  });
}
// ─────────────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <ToastContainer
        /* Inline styles have been removed to restore default positioning */
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={true}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        toastClassName={(context) =>
          /* Note: The 'me-4' class is removed to preserve the correct screen positioning */
          /* Note: The 'w-full' class ensures the toast expands to the container's max width */
          `relative flex w-full p-4 min-h-16 justify-between items-center overflow-hidden cursor-pointer backdrop-blur-xl shadow-2xl rounded-2xl mb-4 border ${
            context?.type === 'success'
              ? 'bg-green-50/20 border-green-200/30'
              : context?.type === 'error'
              ? 'bg-red-50/20 border-red-200/30'
              : context?.type === 'warning'
              ? 'bg-yellow-50/20 border-yellow-200/30'
              : 'bg-white/40 border-white/40'
          }`
        }
        bodyClassName="!text-slate-700 !font-bold !text-sm flex w-full flex-1 text-right items-center"
      />
    </AuthProvider>
  </React.StrictMode>,
);