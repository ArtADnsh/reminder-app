import { useState } from 'react';

const initialFormState = {
  title: '',
  description: '',
  first_reminder: '',
  repeat_reminder: 1,
  time_between_reminders: 0,
};

export default function TaskModal({ isOpen, onClose, onSubmit, isSubmitting }) {
  const [formData, setFormData] = useState(initialFormState);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'repeat_reminder' || name === 'time_between_reminders'
        ? parseInt(value) || 0
        : value,
    }));
  };

  const handleClose = () => {
    setFormData(initialFormState);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800">➕ ثبت یادآور جدید</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-red-500 transition-colors focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">عنوان یادآور *</label>
            <input
              type="text"
              name="title"
              required
              placeholder="مثال: جلسه دیلی با تیم..."
              value={formData.title}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">توضیحات (اختیاری)</label>
            <textarea
              name="description"
              rows="2"
              placeholder="جزئیات بیشتر یادآور..."
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none"
            ></textarea>
          </div>

          {/* یک گرید واحد با ۳ ستون */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* فیلد اول: زمان */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">زمان اولین یادآوری *</label>
              <input
                type="datetime-local"
                name="first_reminder"
                required
                value={formData.first_reminder}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
              />
            </div>

            {/* فیلد دوم: تعداد دفعات */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">تعداد کل دفعات</label>
              <input
                type="number"
                name="repeat_reminder"
                min="1"
                required
                value={formData.repeat_reminder}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary outline-none transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-1">شامل اولین (حداقل ۱)</p>
            </div>

            {/* فیلد سوم: فاصله زمانی */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">فاصله (دقیقه)</label>
              <input
                type="number"
                name="time_between_reminders"
                min="1"
                disabled={formData.repeat_reminder < 2}
                required={formData.repeat_reminder >= 2}
                value={formData.time_between_reminders}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 px-4 py-2.5 text-white font-bold rounded-lg shadow-md transition-colors flex justify-center items-center gap-2
                ${isSubmitting ? 'bg-primary/70 cursor-not-allowed' : 'bg-primary hover:bg-blue-600'}`}
            >
              {isSubmitting ? 'در حال ثبت...' : 'ذخیره یادآور'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
