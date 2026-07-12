import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { toast } from 'react-toastify';
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
    if (taskToEdit) {
      setForm({
        title: taskToEdit.title || '',
        description: taskToEdit.description || '',
        first_reminder: taskToEdit.first_reminder?.slice(0, 16) || '',
        category: taskToEdit.category?.id || '',
        recurrence: taskToEdit.recurrence || 'none',
        repeat_reminder: taskToEdit.repeat_reminder || 1,
        time_between_reminders: taskToEdit.time_between_reminders || '',
      });
    }
  }, [taskToEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim()) errs.title = t('modal.titleRequired');
    if (Object.keys(errs).length) return setErrors(errs);
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
        toast.success(t('modal.updatedSuccess'));
      } else {
        await axiosInstance.post('tasks/', payload);
        toast.success(t('modal.addedSuccess'));
      }
      onSaved?.();
    } catch {
      toast.error(t('modal.saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-surface rounded-[20px] shadow-lg w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-border">
          <h2 className="font-display font-semibold text-lg">
            {mode === 'view' ? t('modal.viewTitle') : taskToEdit ? t('modal.editTitle') : t('modal.newTitle')}
          </h2>
          <button onClick={onClose} aria-label={t('modal.close')} className="p-2 rounded-md hover:bg-surface-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode === 'view' ? (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-foreground">{form.title}</h3>
              {form.description && (
                <p className="mt-3 text-base text-foreground-soft whitespace-pre-wrap leading-relaxed">
                  {form.description}
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <div className="text-xs text-muted mb-1">{t('modal.reminderTime')}</div>
                <div className="font-medium text-sm">
                  {form.first_reminder ? new Date(form.first_reminder).toLocaleString(currentLocale, {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : '—'}
                </div>
              </div>
              
              <div>
                <div className="text-xs text-muted mb-1">{t('modal.category')}</div>
                <div className="font-medium text-sm">
                  {categories.find(c => c.id == form.category)?.name || t('modal.noCategory')}
                </div>
              </div>

              {form.recurrence !== 'none' && (
                <>
                  <div>
                    <div className="text-xs text-muted mb-1">{t('modal.recurrence')}</div>
                    <div className="font-medium text-sm text-primary">
                      {form.recurrence === 'daily' ? t('task.daily') : form.recurrence === 'weekly' ? t('task.weekly') : t('task.monthly')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1">{t('modal.recurrenceSettings')}</div>
                    <div className="font-medium text-sm">
                      {t('task.countLabel')} {form.repeat_reminder} {t('modal.timesInterval')} {form.time_between_reminders} {t('modal.minutesSuffix')}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button onClick={() => setMode('edit')}>{t('modal.editBtn')}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Input
            label={t('modal.fieldTitle')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            error={errors.title}
            placeholder={t('modal.placeholderTitle')}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('modal.fieldDesc')}</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="px-3 py-2 rounded-[10px] border border-border bg-surface text-foreground
                placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder={t('modal.placeholderDesc')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('modal.fieldDateTime')}
              type="datetime-local"
              value={form.first_reminder}
              onChange={(e) => setForm({ ...form, first_reminder: e.target.value })}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('modal.fieldCategory')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-10 px-3 rounded-[10px] border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t('modal.fieldRecurrence')}</label>
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
                  className={`flex-1 h-10 rounded-[10px] text-sm font-medium transition-colors border
                    ${form.recurrence === opt.id 
                      ? 'bg-primary text-white border-primary' 
                      : 'bg-surface text-foreground-soft border-border hover:bg-surface-2'}`}
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
            />
            <Input
              label={t('modal.fieldInterval')}
              type="number"
              min="1"
              disabled={form.recurrence === 'none'}
              value={form.time_between_reminders}
              onChange={(e) => setForm({ ...form, time_between_reminders: parseInt(e.target.value) || '' })}
            />
          </div>
          </form>
        )}

        {mode === 'edit' && (
          <div className="px-5 py-4 border-t border-border flex justify-end gap-2 bg-surface-2">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>{t('modal.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? t('modal.saving') : taskToEdit ? t('modal.saveChanges') : t('modal.add')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
