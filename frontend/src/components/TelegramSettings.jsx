import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getTelegramLinkToken, deleteTelegramConnection } from '../api/telegramApi';

export default function TelegramSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await getTelegramLinkToken();
        setIsConnected(data.is_connected);
      } catch (error) {
        console.error('Error fetching Telegram status:', error);
      } finally {
        setFetching(false);
      }
    };
    fetchStatus();
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const data = await getTelegramLinkToken();
      if (data && data.link_token && data.bot_username) {
        const url = `https://t.me/${data.bot_username}?start=${data.link_token}`;
        window.open(url, '_blank');
        toast.info(t('telegramSettings.successStart'));
      } else {
        toast.error(t('telegramSettings.errorInvalid'));
      }
    } catch (error) {
      toast.error(t('telegramSettings.errorNetwork'));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await deleteTelegramConnection();
      setIsConnected(false);
      toast.success(t('telegramSettings.successDisconnect'));
    } catch (error) {
      toast.error(t('telegramSettings.errorDisconnect'));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 relative flex items-center justify-center min-h-[160px]">
         <div className="w-8 h-8 border-4 border-blue-200 border-t-[#0088cc] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
      <div className={`absolute top-0 end-0 w-1.5 h-full transition-colors duration-500 ${isConnected ? 'bg-green-500' : 'bg-[#0088cc]'}`}></div>
      <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span className="text-xl">🔗</span> {t('telegramSettings.title')}
      </h3>
      
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 transition-all">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-end w-full">
          {/* Status Icon */}
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-inner transition-all duration-300 group-hover:scale-105 ${isConnected ? 'bg-green-50 text-green-500' : 'bg-blue-50 text-[#0088cc]'}`}>
            {isConnected ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
            ) : (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
            )}
          </div>
          <div>
            <h4 className="text-lg font-bold text-gray-800">
                {isConnected ? t('telegramSettings.connectedTitle') : t('telegramSettings.botTitle')}
            </h4>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                {isConnected 
                  ? t('telegramSettings.connectedDesc') 
                  : t('telegramSettings.notConnectedDesc')}
            </p>
          </div>
        </div>
        
        {isConnected ? (
             <button
                onClick={handleDisconnect}
                disabled={loading}
                className={`shrink-0 w-full sm:w-auto px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border-2 ${
                loading 
                    ? 'border-gray-300 text-gray-400 cursor-not-allowed' 
                    : 'border-red-500 text-red-500 hover:bg-red-50 hover:shadow-sm hover:-translate-y-0.5'
                }`}
            >
                {loading && (
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
                {loading ? t('telegramSettings.disconnectingBtn') : t('telegramSettings.disconnectBtn')}
            </button>
        ) : (
            <button
                onClick={handleConnect}
                disabled={loading}
                className={`shrink-0 w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                loading 
                    ? 'bg-blue-400 cursor-not-allowed opacity-80' 
                    : 'bg-[#0088cc] hover:bg-[#0077b5] hover:shadow-lg hover:-translate-y-0.5'
                }`}
            >
                {loading && (
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}
                {loading ? t('telegramSettings.connectingBtn') : t('telegramSettings.connectBtn')}
            </button>
        )}
      </div>
    </div>
  );
}
