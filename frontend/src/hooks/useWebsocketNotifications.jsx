import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import axiosInstance from '../api/axiosInstance';

export const useWebsocketNotifications = (token) => {
  const [notifications, setNotifications] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    const fetchNotifications = async () => {
      try {
        const response = await axiosInstance.get('notifications/');
        const data = response.data.results || response.data;
        const results = Array.isArray(data) ? data : [];
        
        const mapped = results.map(n => ({
          id: n.id,
          title: n.title,
          taskId: n.task_id,
          isRead: n.is_read
        }));
        setNotifications(mapped);
      } catch (error) {
        console.error('Failed to fetch notifications:', error.response?.data || error.message || error);
      }
    };
    fetchNotifications();
  }, [token]);

  const markAsRead = async (id) => {
    try {
      await axiosInstance.patch(`notifications/${id}/mark-read/`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Error marking as read:', error.response?.data || error.message || error);
    }
  };

  const removeNotification = async (id) => {
    try {
      await axiosInstance.delete(`notifications/${id}/`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error.response?.data || error.message || error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axiosInstance.post('notifications/mark-all-read/');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all as read:', error.response?.data || error.message || error);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    if (!token) return;

    let isComponentMounted = true;
    
    const connect = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // In dev with vite proxy or production with nginx, the host will route `/ws/`
      const host = window.location.host;
      const wsUrl = `${wsProtocol}//${host}/ws/notifications/?token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected for notifications.');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (isComponentMounted) {
            const newNotif = {
              id: data.id || Date.now() + Math.random(),
              title: data.title || 'یادآور جدید',
              taskId: data.task_id || null,
              isRead: data.is_read || false
            };

            setNotifications(prev => [newNotif, ...prev]);

            // Display a beautiful custom floating popup using Toastify
            toast(
              <div className="flex flex-col gap-2" dir="rtl">
                <strong className="text-gray-900 text-lg font-extrabold flex items-center gap-2">
                  <span className="text-primary text-xl">✨</span> {newNotif.title}
                </strong>
              </div>, 
              {
                position: "top-right",
                autoClose: 8000,
                hideProgressBar: false,
                closeOnClick: false,
                pauseOnHover: true,
                draggable: true,
                className: 'rounded-2xl shadow-2xl border-2 border-primary/20 p-5 bg-white',
              }
            );
          }
        } catch (error) {
          console.error('Error parsing WS message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected. Attempting reconnect...', event.reason);
        if (isComponentMounted) {
          // Automatic reconnect with backoff
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        ws.close();
      };
    };

    connect();

    return () => {
      isComponentMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        // Clean close code to avoid leaking
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [token]);

  return { notifications, unreadCount, markAsRead, removeNotification, markAllAsRead };
};
