import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import axiosInstance from '../api/axiosInstance';

export const useWebsocketNotifications = (token) => {
  const [notifications, setNotifications] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // 1. Fetch Initial History via REST
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

  // 2. State Mutation Actions
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

  // 3. WebSocket Live Connection
  useEffect(() => {
    if (!token) return;

    let isComponentMounted = true;
    
    const connect = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${wsProtocol}//${host}/ws/notifications/?token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (isComponentMounted) {
            const newNotif = {
              id: data.id, // Strict dependency on database ID
              title: data.title || 'یادآور جدید',
              taskId: data.task_id || null,
              isRead: data.is_read || false
            };

            // Developer warning if backend breaks the contract
            if (!newNotif.id) {
              console.warn('⚠️ Warning: Backend did not send the database ID!');
            }

            setNotifications(prev => [newNotif, ...prev]);

            toast(
              <div className="flex flex-col gap-2" dir="rtl">
                <strong className="text-gray-900 text-lg font-extrabold flex items-center gap-2">
                  <span className="text-primary text-xl">🔔</span> {newNotif.title}
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
        if (isComponentMounted) {
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
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [token]);

  return { notifications, unreadCount, markAsRead, removeNotification, markAllAsRead };
};