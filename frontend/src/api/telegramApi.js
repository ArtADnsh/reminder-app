import axiosInstance from './axiosInstance';

/**
 * Fetches the Telegram linking token and bot username from the backend.
 * This is used to generate a deep link to start a conversation with the Telegram bot.
 *
 * @returns {Promise<{ link_token: string, bot_username: string }>} 
 */
export const getTelegramLinkToken = async () => {
  const response = await axiosInstance.get('telegram/link/');
  return response.data;
};
