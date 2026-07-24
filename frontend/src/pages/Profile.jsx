import { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { userService } from '../api/userService';
import { AuthContext } from '../context/authContext';
import TelegramSettings from '../components/TelegramSettings';
import CategoryManagement from '../components/CategoryManagement';

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { updateUser, logout } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  
  const [accountForm, setAccountForm] = useState({ username: '', email: '' });
  const [accountLoading, setAccountLoading] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const fetchProfile = async () => {
    try {
      const data = await userService.fetchUserProfile();
      setProfileData(data);
      setAccountForm({ username: data.username || '', email: data.email || '' });
    } catch (error) {
      toast.error(t('settings.errorFetchProfile'));
    } finally {
      setLoading(false);
    }
  };

  const handleAccountUpdate = async (e) => {
    e.preventDefault();
    setAccountLoading(true);
    try {
      const updatedUser = await userService.updateUserProfile(accountForm);
      setProfileData(updatedUser);
      updateUser({ username: updatedUser.username, email: updatedUser.email });
      toast.success(t('settings.successUpdateProfile'));
    } catch (error) {
      const errorMsg = error.response?.data?.email?.[0] || error.response?.data?.username?.[0] || t('settings.errorDuplicate');
      toast.error(errorMsg);
    } finally {
      setAccountLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error(t('settings.errorPasswordMismatch'));
      return;
    }
    setPasswordLoading(true);
    try {
      await userService.changePassword({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      toast.success(t('settings.successPasswordChange'));
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      const errorMsg = error.response?.data?.old_password?.[0] || error.response?.data?.new_password?.[0] || error.response?.data?.detail || t('settings.errorInvalidPassword');
      toast.error(errorMsg);
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Handle various potential backend fields for the join date
  const memberSince = profileData?.created_at || profileData?.date_joined;
  const currentLocale = i18n.language === 'fa' ? 'fa-IR' : 'en-US';
  const memberDateString = memberSince ? new Date(memberSince).toLocaleDateString(currentLocale) : t('settings.unknownDate');

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-800">{t('settings.title')}</h2>
      </div>

      <div className="flex flex-col gap-2 mb-6">
        <span className="text-sm font-medium text-foreground-soft">{t('settings.language', 'زبان / Language')}</span>
        <div className="flex items-center bg-surface-2 p-1 rounded-lg border border-border w-fit">
          <button 
            onClick={() => changeLanguage('fa')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${i18n.language === 'fa' ? 'bg-background text-foreground shadow-sm' : 'text-foreground-soft hover:text-foreground'}`}
          >
            🇮🇷 فارسی
          </button>
          <button 
            onClick={() => changeLanguage('en')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${i18n.language === 'en' ? 'bg-background text-foreground shadow-sm' : 'text-foreground-soft hover:text-foreground'}`}
          >
            🇬🇧 English
          </button>
        </div>
      </div>

      {/* Profile Metrics Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white font-bold text-4xl shadow-lg ring-4 ring-blue-50">
          {profileData?.username?.charAt(0).toUpperCase()}
        </div>
        <div className="text-center sm:text-end flex-1">
          <h3 className="text-2xl font-bold text-gray-800">{profileData?.username}</h3>
          <p className="text-gray-500 font-medium mt-1">{profileData?.email || t('settings.noEmail')}</p>
        </div>
        <div className="flex flex-col gap-2 items-center sm:items-end">
          <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 text-center sm:text-end w-full">
            <p className="text-xs text-gray-400 font-bold mb-1 uppercase tracking-wider">{t('settings.memberSince')}</p>
            <p className="text-sm font-semibold text-gray-700">{memberDateString}</p>
          </div>
          <button
            onClick={logout}
            className="text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 w-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            {t('settings.logout')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Account Information Form */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute top-0 end-0 w-1.5 h-full bg-primary"></div>
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-primary">👤</span> {t('settings.accountInfo')}
          </h3>
          <form onSubmit={handleAccountUpdate} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('settings.usernameLabel')}</label>
              <input
                type="text"
                value={accountForm.username}
                onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white outline-none transition-all text-start text-right"
                dir="ltr"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('settings.emailReadonly')}</label>
              <input
                type="email"
                value={accountForm.email}
                className="w-full p-3 bg-gray-100 text-gray-500 border border-gray-200 rounded-xl outline-none cursor-not-allowed text-start opacity-80"
                dir="ltr"
                disabled
              />
            </div>
            <button
              type="submit"
              disabled={accountLoading}
              className={`w-full py-3 bg-primary text-white font-bold rounded-xl shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 ${
                accountLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-600 hover:-translate-y-0.5'
              }`}
            >
              {accountLoading && (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {accountLoading ? t('settings.saving') : t('settings.saveChanges')}
            </button>
          </form>
        </div>

        {/* Security & Password Reset Form */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute top-0 end-0 w-1.5 h-full bg-gray-800"></div>
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-gray-800">🔒</span> {t('settings.securityTitle')}
          </h3>
          <form onSubmit={handlePasswordUpdate} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('settings.currentPassword')}</label>
              <input
                type="password"
                value={passwordForm.old_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-gray-800 focus:bg-white outline-none transition-all text-start"
                dir="ltr"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('settings.newPassword')}</label>
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-gray-800 focus:bg-white outline-none transition-all text-start"
                dir="ltr"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('settings.confirmPassword')}</label>
              <input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-gray-800 focus:bg-white outline-none transition-all text-start"
                dir="ltr"
                required
              />
            </div>
            <button
              type="submit"
              disabled={passwordLoading}
              className={`w-full py-3 bg-gray-800 text-white font-bold rounded-xl shadow-md shadow-gray-800/20 transition-all flex items-center justify-center gap-2 ${
                passwordLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-900 hover:-translate-y-0.5'
              }`}
            >
              {passwordLoading && (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {passwordLoading ? t('settings.updating') : t('settings.changePassword')}
            </button>
          </form>
        </div>

      </div>
      
      {/* Category Management */}
      <CategoryManagement />
      
      {/* Linked Accounts */}
      <TelegramSettings />
    </div>
  );
}
