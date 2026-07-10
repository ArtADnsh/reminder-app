import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { getTelegramLinkToken } from '../api/telegramApi';

export default function TelegramConnectButton() {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const data = await getTelegramLinkToken();
      
      if (data && data.link_token && data.bot_username) {
        // Construct the Telegram deep link URL natively
        const url = `https://t.me/${data.bot_username}?start=${data.link_token}`;
        
        // Open Telegram in a new tab
        window.open(url, '_blank');
      } else {
        toast.error('اطلاعات دریافتی از سرور نامعتبر است.');
      }
    } catch (error) {
      console.error('[TelegramConnect] Error fetching link token:', error);
      const errorMsg = error.response?.data?.detail || 'مشکلی در برقراری ارتباط با سرور تلگرام پیش آمد.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6 transition-all hover:shadow-md group">
      <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right">
        {/* Telegram SVG Icon */}
        <div className="w-14 h-14 bg-blue-50 text-[#0088cc] rounded-full flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">ربات تلگرام</h3>
          <p className="text-sm text-gray-500 mt-1">با اتصال حساب خود، یادآورها را مستقیماً در تلگرام دریافت کنید.</p>
        </div>
      </div>
      
      <button
        onClick={handleConnect}
        disabled={loading}
        className={`shrink-0 w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
          loading 
            ? 'bg-blue-400 cursor-not-allowed opacity-80' 
            : 'bg-[#0088cc] hover:bg-[#0077b5] hover:shadow-lg hover:-translate-y-0.5'
        }`}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            در حال ارتباط...
          </>
        ) : (
          <>
            اتصال به تلگرام 🚀
          </>
        )}
      </button>
    </div>
  );
}
