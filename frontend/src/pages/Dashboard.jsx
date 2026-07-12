import { toast } from 'react-toastify';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Bell, Clock, CheckCircle2, AlertCircle, Repeat, Undo2, Folder } from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import { categoryApi } from '../api/categoryApi';
import TaskModal from '../components/TaskModal';
import { subscribeToWebPush } from '../utils/webPush';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Chip from '../components/ui/Chip';
import EmptyState from '../components/ui/EmptyState';
import SkeletonRow from '../components/ui/SkeletonRow';

const STATUS_TABS = [
  { key: 'pending', labelKey: 'filters.pending' },
  { key: 'recurring', labelKey: 'filters.recurring' },
  { key: 'done', labelKey: 'filters.done' },
  { key: 'all', labelKey: 'filters.all' },
];

const TIME_FILTERS = [
  { key: 'today', label: 'امروز' },
  { key: 'week', label: 'این هفته' },
  { key: 'month', label: 'این ماه' },
  { key: 'all', label: 'همه' },
];

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language === 'fa' ? 'fa-IR' : 'en-US';
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('pending');
  const [activeTimeFilter, setActiveTimeFilter] = useState('today');
  const [activeCategory, setActiveCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [showPushBanner, setShowPushBanner] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('edit');
  const [modalKey, setModalKey] = useState(0);
  const [taskToEdit, setTaskToEdit] = useState(null);

  const deleteTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
    };
  }, []);

  const openModal = (task = null, mode = 'edit') => {
    if (task && task.nativeEvent) task = null;
    setTaskToEdit(task);
    setModalMode(mode);
    setModalKey((k) => k + 1);
    setIsModalOpen(true);
  };

  const fetchTasks = () => {
    setLoading(true);
    axiosInstance.get('tasks/')
      .then((r) => setTasks(r.data))
      .catch(() => toast.error(t('dashboard.errorLoading')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    categoryApi.fetchCategories().then(setCategories).catch(console.error);
    fetchTasks();
  }, []);

  const timeFilteredTasks = useMemo(() => {
    if (activeTimeFilter === 'all') return tasks;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return tasks.filter(t => {
      if (!t.first_reminder) return false;
      const d = new Date(t.first_reminder);
      if (activeTimeFilter === 'today') {
        return d >= today && d < new Date(today.getTime() + 86400000);
      }
      if (activeTimeFilter === 'week') {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        return d >= startOfWeek && d < endOfWeek;
      }
      if (activeTimeFilter === 'month') {
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      }
      return true;
    });
  }, [tasks, activeTimeFilter]);

  const stats = useMemo(() => {
    const todayStr = new Date().toDateString();
    return {
      today: timeFilteredTasks.filter((t) => t.first_reminder && new Date(t.first_reminder).toDateString() === todayStr).length,
      pending: timeFilteredTasks.filter((t) => !t.is_done).length,
      overdue: timeFilteredTasks.filter((t) => !t.is_done && t.first_reminder && new Date(t.first_reminder) < new Date()).length,
      done: timeFilteredTasks.filter((t) => t.is_done).length,
    };
  }, [timeFilteredTasks]);

  const filteredTasks = useMemo(() => {
    let res = timeFilteredTasks;
    if (activeCategory !== 'all') {
      res = res.filter((t) => t.category?.id === activeCategory);
    }
    if (activeStatus === 'pending') {
      res = res.filter((t) => !t.is_done);
    } else if (activeStatus === 'done') {
      res = res.filter((t) => t.is_done);
    } else if (activeStatus === 'recurring') {
      res = res.filter((t) => !t.is_done && t.recurrence && t.recurrence !== 'none');
    }
    
    return [...res].sort((a, b) => new Date(b.first_reminder || 0) - new Date(a.first_reminder || 0));
  }, [timeFilteredTasks, activeStatus, activeCategory]);

  const isOverdue = (t) => !t.is_done && t.first_reminder && new Date(t.first_reminder) < new Date();

  const handleToggle = async (task) => {
    try {
      await axiosInstance.patch(`tasks/${task.id}/`, { is_done: !task.is_done });
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_done: !task.is_done } : t))
      );
    } catch {
      toast.error(t('dashboard.errorToggle'));
    }
  };

  const handleDelete = (task) => {
    // Optimistically remove from state
    setTasks((prev) => prev.filter((t) => t.id !== task.id));

    // Schedule actual delete
    const timer = setTimeout(async () => {
      try {
        await axiosInstance.delete(`tasks/${task.id}/`);
      } catch {
        toast.error(t('dashboard.errorDelete'));
        fetchTasks(); // Restore sync if backend fails
      }
    }, 5000);
    deleteTimeoutRef.current = timer;

    // Show undo toast
    toast(
      ({ closeToast }) => (
        <div className="flex items-center justify-between w-full">
          <span className="font-semibold text-white">{t('dashboard.taskDeleted')}</span>
          <button
            onClick={() => {
              clearTimeout(timer);
              setTasks((prev) => [...prev, task]);
              closeToast();
            }}
            className="p-1.5 rounded-md text-white hover:text-primary hover:bg-slate-700 transition-all duration-200"
            aria-label={t('dashboard.undo')}
          >
            <Undo2 className="w-5 h-5" />
          </button>
        </div>
      ),
      {
        className: '!bg-slate-800 !rounded-[14px] !border !border-slate-700 !shadow-lg',
        bodyClassName: '!p-0 !m-0',
        progressClassName: 'custom-solid-progress',
        closeButton: false,
        autoClose: 5000,
      }
    );
  };

  return (
    <div className="space-y-6">
      {showPushBanner && (
        <Card className="flex items-center gap-3 bg-primary-soft border-primary/20">
          <Bell className="w-5 h-5 text-primary" />
          <div className="flex-1 text-sm">{t('dashboard.enablePushText')}</div>
          <Button size="sm" onClick={subscribeToWebPush}>{t('dashboard.enablePushBtn')}</Button>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">{t('dashboard.title')}</h1>
          <p className="text-sm text-foreground-soft mt-1">
            {tasks.length} {t('dashboard.totalItems')}
          </p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="w-4 h-4" /> {t('dashboard.addTask')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon={Bell} label={t('filters.pending')} value={stats.pending} tone="warning" />
        <StatCard icon={AlertCircle} label={t('filters.overdue')} value={stats.overdue} tone="danger" />
        <StatCard icon={CheckCircle2} label={t('filters.done')} value={stats.done} tone="success" />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex gap-2 bg-surface-2 rounded-[10px] p-1 w-fit">
          {STATUS_TABS.map((tItem) => (
            <button
              key={tItem.key}
              onClick={() => setActiveStatus(tItem.key)}
              className={`h-8 px-3 rounded-[8px] text-sm font-medium transition-colors
                ${activeStatus === tItem.key ? 'bg-surface text-foreground shadow-sm' : 'text-foreground-soft hover:text-foreground'}`}
            >
              {t(tItem.labelKey)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-auto">
            <Clock className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-soft" />
            <select
              value={activeTimeFilter}
              onChange={(e) => setActiveTimeFilter(e.target.value)}
              className="appearance-none bg-surface-2 border border-border rounded-[8px] h-9 ps-8 pe-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto cursor-pointer"
            >
              <option value="today">{t('filters.today')}</option>
              <option value="week">{t('filters.week')}</option>
              <option value="month">{t('filters.month')}</option>
              <option value="all">{t('filters.all')}</option>
            </select>
          </div>

          <div className="relative w-full sm:w-auto">
            <Folder className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-soft" />
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className="appearance-none bg-surface-2 border border-border rounded-[8px] h-9 ps-8 pe-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-auto cursor-pointer"
            >
              <option value="all">{t('filters.allCategories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t('dashboard.emptyTitle')}
            description={t('dashboard.emptyDesc')}
            actionLabel={t('dashboard.addTask')}
            onAction={() => openModal()}
          />
        ) : (
          filteredTasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              overdue={isOverdue(task)} 
              onView={() => openModal(task, 'view')}
              onEdit={() => openModal(task, 'edit')} 
              onToggle={() => handleToggle(task)}
              onDelete={() => handleDelete(task)}
            />
          ))
        )}
      </div>

      {isModalOpen && (
        <TaskModal
          key={modalKey}
          isOpen={isModalOpen}
          initialMode={modalMode}
          onClose={() => setIsModalOpen(false)}
          taskToEdit={taskToEdit}
          categories={categories}
          onSaved={() => {
            setIsModalOpen(false);
            fetchTasks();
          }}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    primary: 'bg-primary-soft text-primary',
    warning: 'bg-orange-50 text-warning',
    danger: 'bg-danger-soft text-danger',
    success: 'bg-emerald-50 text-success',
  };
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-display font-semibold text-foreground leading-none">{value}</div>
          <div className="text-xs text-foreground-soft mt-1">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function TaskCard({ task, overdue, onView, onEdit, onToggle, onDelete }) {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language === 'fa' ? 'fa-IR' : 'en-US';
  const done = task.is_done;
  const isRecurring = task.recurrence && task.recurrence !== 'none';
  const isToday = task.first_reminder && new Date(task.first_reminder).toDateString() === new Date().toDateString();

  return (
    <div
      onClick={onView}
      className={`bg-surface rounded-[14px] border border-border border-s-4 shadow-sm p-4 flex items-start gap-4
        transition-all duration-300 hover:bg-surface-2 hover:shadow-md hover:-translate-y-[2px] cursor-pointer
        animate-in fade-in slide-in-from-bottom-2
        ${done ? 'opacity-60' : ''}`}
      style={{ borderInlineStartColor: task.category?.color || '#9ca3af' }}
    >
      <input
        type="checkbox"
        checked={done}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggle}
        className="w-5 h-5 mt-0.5 rounded accent-primary flex-shrink-0 cursor-pointer"
        aria-label={t('task.markDone')}
      />

      <div className="flex-1 min-w-0">
        <h3 className={`font-medium text-foreground truncate ${done ? 'line-through' : ''}`}>
          {task.title}
        </h3>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-foreground-soft">
          {task.first_reminder && (
            <span className={`inline-flex items-center gap-1 ${overdue ? 'text-danger font-medium' : ''}`}>
              <Clock className="w-3 h-3" />
              {isToday ? new Date(task.first_reminder).toLocaleTimeString(currentLocale, {
                hour: '2-digit', minute: '2-digit'
              }) : new Date(task.first_reminder).toLocaleString(currentLocale, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          )}
          {isRecurring && (
            <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary-soft px-2 py-0.5 rounded-full">
              <Repeat className="w-3 h-3" /> 
              {task.recurrence === 'daily' ? t('task.daily') : task.recurrence === 'weekly' ? t('task.weekly') : t('task.monthly')}
              {' | '}{t('task.countLabel')} {task.repeat_reminder} {' | '}{t('task.intervalLabel')} {task.time_between_reminders} {t('task.minutes')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          aria-label={t('task.edit')}
          className="p-2 rounded-md hover:bg-surface text-foreground-soft hover:text-primary transition-colors border border-transparent hover:border-border"
          title={t('task.edit')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={t('task.delete')}
          className="p-2 rounded-md hover:bg-danger-soft text-foreground-soft hover:text-danger transition-colors border border-transparent hover:border-danger/20"
          title={t('task.delete')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );
}