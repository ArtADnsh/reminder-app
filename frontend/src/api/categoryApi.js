import axiosInstance from './axiosInstance';

export const categoryApi = {
  fetchCategories: async () => {
    const response = await axiosInstance.get('categories/');
    return response.data;
  },
  createCategory: async (data) => {
    const response = await axiosInstance.post('categories/', data);
    return response.data;
  },
  deleteCategory: async (id) => {
    const response = await axiosInstance.delete(`categories/${id}/`);
    return response.data;
  }
};
