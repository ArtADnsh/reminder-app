import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';
import TaskModal from '../components/TaskModal';
import TelegramConnectButton from '../components/TelegramConnectButton';
import { subscribeToWebPush } from '../utils/webPush';

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeStatus, setActiveStatus] = useState('pending');
  const [showPushBanner, setShowPushBanner] = useState(false);

  // State های مربوط به مودال
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openModal = () => {
    setModalKey((key) => key + 1);
    setIsModalOpen(true);
  };

  const buildFetchUrl = () => {
    const params = new URLSearchParams();
    if (activeFilter !== 'all') params.append('filter', activeFilter);
    if (activeStatus !== 'all') params.append('status', activeStatus);
    const qs = params.toString();
    return qs ? `tasks/?${qs}` : 'tasks/';
  };

  const fetchTasks = async () => {
    try {
      const response = await axiosInstance.get(buildFetchUrl());
      setTasks(response.data);
    } catch (error) {
      console.error('خطا در بارگذاری یادآورها:', error);
      toast.error('خطا در بارگذاری یادآورها. لطفا صفحه را رفرش کنید.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    axiosInstance.get(buildFetchUrl())
      .then((response) => {
        if (!cancelled) setTasks(response.data);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('خطا در بارگذاری یادآورها:', error);
          toast.error('خطا در بارگذاری یادآورها. لطفا صفحه را رفرش کنید.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeFilter, activeStatus]);

  // چک کردن دسترسی برای نمایش بنر پوش‌نوتیفیکیشن
  useEffect(() => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      if (Notification.permission === 'default') {
        setShowPushBanner(true);
      }
    }
  }, []);

  const handleEnablePush = async () => {
    const subscription = await subscribeToWebPush();
    if (subscription) {
      toast.success('اعلان‌های سیستم با موفقیت فعال شد! 🔔');
      setShowPushBanner(false);
    } else {
      toast.error('فعال‌سازی اعلان‌ها لغو شد یا با خطا مواجه گردید.');
      setShowPushBanner(false);
    }
  };

// هندل کردن ثبت تسک جدید با Payload هوشمند
  const handleCreateTask = async (formData) => {
    setIsSubmitting(true);
    try {
      // ۱. ساخت بسته پایه (فیلدهایی که همیشه باید فرستاده شوند)
      const payload = {
        title: formData.title,
        description: formData.description,
        first_reminder: formData.first_reminder,
        repeat_reminder: formData.repeat_reminder,
      };

      // ۲. اضافه کردن فیلدهای تکرار، فقط در صورتی که کاربر تیک را زده باشد
      if (formData.repeat_reminder >= 2) {
        payload.time_between_reminders = formData.time_between_reminders;
      }
      // اگر تیک نخورده باشد، این فیلدها اصلاً به سرور ارسال نمی‌شوند (Left Empty)

      // ۳. ارسال بسته به سرور
      await axiosInstance.post('tasks/', payload);

      setIsModalOpen(false); // بستن مودال
      fetchTasks(); // رفرش لیست
      toast.success('یادآور با موفقیت ثبت شد 🚀');
    } catch (error) {
      console.error('خطا در ثبت یادآور:', error);
      // خواندن دقیق ارورهای جنگو برای نمایش در پاپ‌آپ
      const errorMsg =
        error.response?.data?.non_field_errors?.[0] ||
        error.response?.data?.detail ||
        'خطا در ثبت یادآور. لطفا دوباره تلاش کنید.';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // هندل کردن تغییر وضعیت انجام کار (Toggle is_done)
  const handleToggleDone = async (id, currentStatus) => {
    // آپدیت ظاهری سریع (Optimistic UI)
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, is_done: !currentStatus } : task
    ));

    try {
      await axiosInstance.patch(`tasks/${id}/`, {
        is_done: !currentStatus
      });
      if (!currentStatus) {
        toast.success('یادآور انجام شد ✅');
      }
    } catch (error) {
      console.error('خطا در تغییر وضعیت:', error);
      fetchTasks(); // بازگردانی به حالت قبل در صورت خطا
      toast.error('مشکلی در ارتباط با سرور پیش آمد!');
    }
  };

  // هندل کردن حذف تسک
  const handleDeleteTask = async (id) => {
    if (!window.confirm('آیا از حذف این یادآور اطمینان دارید؟')) return;

    try {
      await axiosInstance.delete(`tasks/${id}/`);
      setTasks(tasks.filter(task => task.id !== id));
      toast.info('یادآور حذف شد 🗑️');
    } catch (error) {
      console.error('خطا در حذف یادآور:', error);
      toast.error('خطا در حذف یادآور.');
    }
  };


  return (
    <div>
      {/* Smart Push Notification Banner */}
      {showPushBanner && (
        <div className="mb-6 bg-gradient-to-r from-blue-600 to-primary rounded-2xl shadow-lg p-5 sm:p-6 text-white flex flex-col lg:flex-row items-center justify-between gap-5 animate-fade-in relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start lg:items-center gap-4 relative z-10 w-full lg:w-auto text-center sm:text-right">
            <div className="bg-white/20 p-3.5 rounded-2xl shrink-0">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-1">دریافت آنی یادآورها</h3>
              <p className="text-sm text-blue-100 font-medium">برای دریافت یادآورهای خود در پس‌زمینه، لطفا دسترسی ارسال اعلان را به مرورگر بدهید.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center relative z-10 shrink-0 mt-2 lg:mt-0">
            <button 
              onClick={() => setShowPushBanner(false)}
              className="px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-800/40 hover:bg-blue-800/60 transition-colors"
            >
              فعلا نه
            </button>
            <button 
              onClick={handleEnablePush}
              className="px-6 py-2.5 rounded-xl font-extrabold text-sm bg-white text-primary hover:bg-gray-50 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              فعال‌سازی اعلان‌ها
            </button>
          </div>
        </div>
      )}

      {/* هدر داشبورد */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">یادآورهای فعال</h2>
        <div className="flex flex-wrap items-center gap-3">
          <TelegramConnectButton />
          <button
            onClick={openModal}
            className="px-5 py-2.5 bg-primary text-white font-bold rounded-lg shadow-md hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <span className="text-xl leading-none">+</span> یادآور جدید
          </button>
        </div>
      </div>

      {/* نوار فیلترها */}
      <div className="flex flex-col xl:flex-row gap-4 mb-8 justify-between items-start xl:items-center bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
        {/* فیلترهای زمانی */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'همه زمان‌ها' },
            { id: 'today', label: 'امروز' },
            { id: 'this_week', label: 'این هفته' },
            { id: 'this_month', label: 'این ماه' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              disabled={loading}
              className={`px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 shadow-sm outline-none border ${
                activeFilter === tab.id
                  ? 'bg-primary text-white border-primary scale-105 shadow-primary/30'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-100 hover:border-gray-200 hover:text-primary'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* فیلترهای وضعیت */}
        <div className="flex items-center bg-gray-50 p-1.5 rounded-xl border border-gray-200 shadow-inner w-full xl:w-auto">
          {[
            { id: 'all', label: 'همه وضعیت‌ها' },
            { id: 'pending', label: 'در انتظار ⏳' },
            { id: 'completed', label: 'انجام شده ✅' }
          ].map(status => (
            <button
              key={status.id}
              onClick={() => setActiveStatus(status.id)}
              disabled={loading}
              className={`flex-1 xl:flex-none px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 outline-none ${
                activeStatus === status.id
                  ? 'bg-white text-gray-800 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* مودال ساخت تسک */}
      <TaskModal
        key={modalKey}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTask}
        isSubmitting={isSubmitting}
      />

      {/* لیست تسک‌ها یا اسکلتون */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-pulse h-40"></div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-20 bg-white rounded-2xl border border-gray-100 border-dashed">
          <div className="text-6xl mb-4 opacity-80">📭</div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">
            {activeFilter === 'all' ? 'هیچ یادآوری وجود ندارد' : 'یادآوری برای این بازه زمانی یافت نشد'}
          </h3>
          <p className="text-gray-500 mb-6 max-w-sm">
            {activeFilter === 'all' 
              ? 'اولین یادآور خود را ثبت کنید تا سیستم پردازش‌های Celery کار خود را آغاز کند.'
              : 'بازه‌های زمانی دیگر را بررسی کنید یا یادآور جدیدی بسازید.'}
          </p>
          <button
            onClick={openModal}
            className="px-6 py-2.5 border-2 border-primary text-primary font-bold rounded-lg hover:bg-blue-50 transition-colors"
          >
            ثبت یادآور جدید
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group flex flex-col h-full
                ${task.is_done ? 'opacity-70 bg-gray-50' : ''}`}
            >
              {/* نشانگر رنگی وضعیت */}
              <div className={`absolute top-0 right-0 w-1.5 h-full transition-colors ${task.is_done ? 'bg-accent' : 'bg-primary'}`}></div>

              <div className="flex justify-between items-start mb-2 pr-2">
                <h3 className={`text-lg font-bold truncate pr-2 ${task.is_done ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                  {task.title}
                </h3>
                {/* دکمه تغییر وضعیت (چک‌باکس استایلیش) */}
                <button
                  onClick={() => handleToggleDone(task.id, task.is_done)}
                  className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors border-2 
                    ${task.is_done ? 'bg-accent border-accent text-white' : 'border-gray-300 hover:border-accent text-transparent'}`}
                  title={task.is_done ? "علامت‌گذاری به عنوان انجام نشده" : "علامت‌گذاری به عنوان انجام شده"}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>

              {task.description && (
                <p className="text-gray-500 text-sm line-clamp-2 mb-4 pr-2 flex-grow">
                  {task.description}
                </p>
              )}

              <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center pr-2">
                <div className="flex flex-col gap-1 text-xs font-medium text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="text-gray-400">📅</span>
                    {new Date(task.first_reminder).toLocaleString('fa-IR', {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                  {task.repeat_reminder > 1 ? (
                    <span className="flex items-center gap-1 text-primary">
                      <span>🔁</span> {task.repeat_reminder} بار، هر {task.time_between_reminders || 0} دقیقه
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-400">
                      <span>📍</span> یک‌بار مصرف
                    </span>
                  )}
                </div>

                {/* دکمه حذف */}
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="حذف یادآور"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}