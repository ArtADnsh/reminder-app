import { toast } from 'react-toastify';
import { Bell } from 'lucide-react';

/**
 * Standardized toast helper to maintain the application's design system.
 * It wraps the message in a consistent typographic structure.
 */
export const showToast = {
  success: (message, options) => toast.success(
    <span className="flex-1 text-right text-slate-600 font-bold">{message}</span>, options
  ),
  error: (message, options) => toast.error(
    <span className="flex-1 text-right text-slate-600 font-bold">{message}</span>, options
  ),
  info: (message, options) => toast.info(
    <span className="flex-1 text-right text-slate-600 font-bold">{message}</span>, options
  ),
  warning: (message, options) => toast.warning(
    <span className="flex-1 text-right text-slate-600 font-bold">{message}</span>, options
  ),
  reminder: (taskTitle, time, description, options) => toast(
    <div dir="rtl" className="flex items-center w-full gap-3 text-right">
      <div className="flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-primary/10 shadow-sm">
        <Bell className="w-5 h-5 text-primary" />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-slate-800 font-bold text-base leading-snug truncate">{taskTitle}</span>
        {(time || description) && (
          <span className="text-slate-500 text-sm mt-0.5 font-medium line-clamp-2 leading-relaxed">
            {time && <span>{time}</span>}
            {time && description && <span className="mx-1.5">•</span>}
            {description && <span>{description}</span>}
          </span>
        )}
      </div>
    </div>,
    {
      ...options,
      type: 'info',
      icon: false,
      bodyClassName: '!p-0 w-full flex items-center',
    }
  ),
  custom: (content, options) => toast(content, options)
};
