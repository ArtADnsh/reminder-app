import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { showToast } from '../utils/toastHelper';
import axiosInstance from '../api/axiosInstance';
import Button from './ui/Button';
import Input from './ui/Input';

export default function TaskModal({ isOpen, onClose, taskToEdit, categories = [], onSaved, initialMode = 'edit' }) {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language === 'fa' ? 'fa-IR' : 'en-US';
  
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({
    title: '', description: '', first_reminder: '', category: '', 
    recurrence: 'none', repeat_reminder: 1, time_between_reminders: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!taskToEdit) return;
    
    setForm({
      title: taskToEdit.title || '',
      description: taskToEdit.description || '',
      first_reminder: taskToEdit.first_reminder?.slice(0, 16) || '',
      category: taskToEdit.category?.id || '',
      recurrence: taskToEdit.recurrence || 'none',
      repeat_reminder: taskToEdit.repeat_reminder || 1,
      time_between_reminders: taskToEdit.time_between_reminders || '',
    });
  }, [taskToEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errs = {};
    if (!form.title.trim()) {
      errs.title = t('modal.titleRequired');
    }
    
    if (!form.first_reminder) {
      errs.first_reminder = 'تاریخ و زمان الزامی است';
    }
    
    if (form.repeat_reminder === '' || form.repeat_reminder <= 0) {
      errs.repeat_reminder = 'عدد باید بزرگتر از ۰ باشد';
    }
    
    if (form.repeat_reminder > 1) {
      if (form.time_between_reminders === '' || form.time_between_reminders <= 0) {
        errs.time_between_reminders = 'فاصله زمانی نامعتبر است';
      }
    }
    
    if (Object.keys(errs).length > 0) {
      return setErrors(errs);
    }
    setErrors({});
    
    const payload = {
      title: form.title,
      description: form.description,
      first_reminder: form.first_reminder || null,
      category: form.category || null,
      recurrence: form.recurrence,
      repeat_reminder: form.repeat_reminder || 1,
      time_between_reminders: form.time_between_reminders || null,
    };

    setSubmitting(true);
    try {
      if (taskToEdit) {
        await axiosInstance.patch(`tasks/${taskToEdit.id}/`, payload);
        showToast.success(t('modal.updatedSuccess'));
      } else {
        await axiosInstance.post('tasks/', payload);
        showToast.success(t('modal.addedSuccess'));
      }
      onSaved?.();
    } catch (error) {
      showToast.error(t('modal.saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  const getModalTitle = () => {
    if (mode === 'view') return t('modal.viewTitle');
    if (taskToEdit) return t('modal.editTitle');
    return t('modal.newTitle');
  };

  const getRecurrenceLabel = (recurrenceType) => {
    const mapping = {
      daily: 'task.daily',
      weekly: 'task.weekly',
      monthly: 'task.monthly',
    };
    return t(mapping[recurrenceType] || '');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative bg-white/60 backdrop-blur-2xl border border-white/80 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-3xl w-full max-w-lg mx-4 overflow-hidden animate-modal text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/40">
          <h2 className="font-display font-bold text-xl text-slate-800">
            {getModalTitle()}
          </h2>
          <button onClick={onClose} aria-label={t('modal.close')} className="p-2 rounded-xl hover:bg-white/50 text-slate-500 hover:text-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode === 'view' ? (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-800">{form.title}</h3>
              {form.description && (
                <p className="mt-3 text-base text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {form.description}
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/40">
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('modal.reminderTime')}</div>
                <div className="font-medium text-sm text-slate-800">
                  {form.first_reminder ? new Date(form.first_reminder).toLocaleString(currentLocale, {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : '—'}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('modal.category')}</div>
                <div className="font-medium text-sm text-slate-800">
                  {categories.find(c => c.id == form.category)?.name || t('modal.noCategory')}
                </div>
              </div>

              {form.recurrence !== 'none' && (
                <>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">{t('modal.recurrence')}</div>
                    <div className="font-medium text-sm text-primary">
                      {getRecurrenceLabel(form.recurrence)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">{t('modal.recurrenceSettings')}</div>
                    <div className="font-medium text-sm text-slate-800">
                      {t('task.countLabel')} {form.repeat_reminder} {t('modal.timesInterval')} {form.time_between_reminders} {t('modal.minutesSuffix')}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={() => setMode('edit')} className="h-10 px-4 text-sm font-bold rounded-xl bg-primary text-white shadow-md hover:bg-primary/90 transition-colors">{t('modal.editBtn')}</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label={t('modal.fieldTitle')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            error={errors.title}
            placeholder={t('modal.placeholderTitle')}
            className="!bg-slate-100/50 !border-white/50 !text-slate-800 placeholder:!text-slate-400 !rounded-xl"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-800">{t('modal.fieldDesc')}</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="px-3 py-2 rounded-xl border border-white/50 bg-slate-100/50 text-slate-800
                placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder={t('modal.placeholderDesc')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('modal.fieldDateTime')}
              type="datetime-local"
              value={form.first_reminder}
              onChange={(e) => setForm({ ...form, first_reminder: e.target.value })}
              error={errors.first_reminder}
              className="!bg-slate-100/50 !border-white/50 !text-slate-800 !rounded-xl"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-800">{t('modal.fieldCategory')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-10 px-3 rounded-xl border border-white/50 bg-slate-100/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-800">{t('modal.fieldRecurrence')}</label>
            <div className="flex gap-2">
              {[
                { id: 'none', labelKey: 'modal.recurrenceNone' },
                { id: 'daily', labelKey: 'task.daily' },
                { id: 'weekly', labelKey: 'task.weekly' },
                { id: 'monthly', labelKey: 'task.monthly' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setForm({ ...form, recurrence: opt.id })}
                  className={`flex-1 h-10 rounded-xl text-sm font-bold transition-colors border
                    ${form.recurrence === opt.id 
                      ? 'bg-primary text-white border-primary shadow-md' 
                      : 'bg-slate-100/50 text-slate-600 border-white/50 hover:bg-white/70 hover:text-slate-800'}`}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('modal.fieldCount')}
              type="number"
              min="1"
              value={form.repeat_reminder}
              onChange={(e) => setForm({ ...form, repeat_reminder: parseInt(e.target.value) || '' })}
              error={errors.repeat_reminder}
              className="!bg-slate-100/50 !border-white/50 !text-slate-800 !rounded-xl"
            />
            <Input
              label={t('modal.fieldInterval')}
              type="number"
              min="1"
              disabled={form.repeat_reminder <= 1}
              value={form.time_between_reminders}
              onChange={(e) => setForm({ ...form, time_between_reminders: parseInt(e.target.value) || '' })}
              error={errors.time_between_reminders}
              className="!bg-slate-100/50 !border-white/50 !text-slate-800 !rounded-xl"
            />
          </div>
          </form>
        )}

        {mode === 'edit' && (
          <div className="px-6 py-4 border-t border-white/40 flex justify-end gap-3 bg-white/30 backdrop-blur-md">
            <button type="button" onClick={onClose} disabled={submitting} className="h-10 px-5 text-sm font-bold rounded-xl text-slate-600 bg-slate-100/50 hover:bg-white/70 hover:text-slate-900 transition-colors disabled:opacity-50">
              {t('modal.cancel')}
            </button>
            <button onClick={handleSubmit} disabled={submitting} className="h-10 px-6 text-sm font-bold rounded-xl bg-primary text-white shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50">
              {submitting ? t('modal.saving') : taskToEdit ? t('modal.saveChanges') : t('modal.add')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
