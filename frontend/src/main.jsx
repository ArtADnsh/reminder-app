import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <ToastContainer
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
        toastClassName="!bg-white/60 !backdrop-blur-2xl !border !border-white/80 !shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] !rounded-2xl !text-slate-800 font-sans text-sm mb-4 me-4"
        bodyClassName="!text-slate-800 !font-medium"
      />
    </AuthProvider>
  </React.StrictMode>,
);