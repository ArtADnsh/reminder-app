import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { categoryApi } from '../api/categoryApi';

const PRESET_COLORS = [
  '#FCA5A5', // Pastel Red
  '#93C5FD', // Pastel Blue
  '#86EFAC', // Pastel Green
  '#FDE047', // Pastel Yellow
  '#D8B4FE', // Pastel Purple
  '#FDBA74', // Pastel Orange
  '#CBD5E1', // Pastel Slate
  '#F9A8D4'  // Pastel Pink
];

export default function CategoryManagement() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', color: PRESET_COLORS[0] });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await categoryApi.fetchCategories();
      setCategories(data);
    } catch (error) {
      toast.error(t('categories.errorFetch'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSubmitting(true);
    try {
      await categoryApi.createCategory(formData);
      toast.success(t('categories.successCreate'));
      setFormData({ name: '', color: PRESET_COLORS[0] });
      fetchCategories();
    } catch (error) {
      toast.error(t('categories.errorCreate'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('categories.confirmDelete'))) return;
    try {
      await categoryApi.deleteCategory(id);
      toast.info(t('categories.successDelete'));
      setCategories(categories.filter(c => c.id !== id));
    } catch (error) {
      toast.error(t('categories.errorDelete'));
    }
  };

  const suggestedCategories = [
    { name: 'Work', label: t('categories.suggestedWork'), color: '#93C5FD' },
    { name: 'Personal', label: t('categories.suggestedPersonal'), color: '#FCA5A5' },
    { name: 'Health', label: t('categories.suggestedHealth'), color: '#86EFAC' },
    { name: 'Study', label: t('categories.suggestedStudy'), color: '#D8B4FE' },
  ];

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
      <div className="absolute top-0 end-0 w-1.5 h-full bg-purple-500"></div>
      <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span className="text-xl">🏷️</span> {t('categories.title')}
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* فرم ایجاد دسته‌بندی */}
        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
          <h4 className="text-md font-bold text-gray-700 mb-4">{t('categories.newCategory')}</h4>
          
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-500 mb-2">{t('categories.suggestions')}</p>
            <div className="flex flex-wrap gap-2">
              {suggestedCategories.map((sug) => (
                <button
                  key={sug.name}
                  type="button"
                  onClick={() => setFormData({ name: sug.label, color: sug.color })}
                  className="px-3 py-1 rounded-full text-xs font-bold border transition-transform hover:scale-105"
                  style={{ backgroundColor: `${sug.color}33`, borderColor: sug.color, color: '#4B5563' }}
                >
                  {sug.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('categories.categoryName')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-500 outline-none transition-all"
                placeholder={t('categories.placeholder')}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">{t('categories.selectColor')}</label>
              <div className="flex flex-wrap gap-3">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-full shadow-sm transition-transform ${formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-2.5 bg-purple-600 text-white font-bold rounded-xl shadow-md shadow-purple-600/20 transition-all flex items-center justify-center gap-2 mt-2 ${
                submitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700 hover:-translate-y-0.5'
              }`}
            >
              {submitting ? t('categories.creating') : t('categories.createBtn')}
            </button>
          </form>
        </div>

        {/* لیست دسته‌بندی‌ها */}
        <div>
          <h4 className="text-md font-bold text-gray-700 mb-4">{t('categories.currentCategories')}</h4>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
              <p className="text-gray-500 text-sm">{t('categories.noCategories')}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pe-1">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color || '#CBD5E1' }}></div>
                    <span className="font-bold text-gray-700">{cat.name}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    title={t('categories.delete')}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
