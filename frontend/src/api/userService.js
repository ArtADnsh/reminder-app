import axiosInstance from './axiosInstance';

export const userService = {
  fetchUserProfile: async () => {
    const response = await axiosInstance.get('users/me/');
    return response.data;
  },
  
  updateUserProfile: async (data) => {
    const response = await axiosInstance.patch('users/me/', data);
    return response.data;
  },

  changePassword: async (passwords) => {
    const response = await axiosInstance.post('users/me/change-password/', passwords);
    return response.data;
  }
};
