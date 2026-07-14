import { toast } from 'react-toastify';

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
  custom: (content, options) => toast(content, options)
};
