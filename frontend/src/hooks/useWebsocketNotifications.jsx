import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

export const useWebsocketNotifications = (token) => {
  const [notifications, setNotifications] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
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
              id: Date.now() + Math.random(),
              title: data.title || 'یادآور جدید',
              description: data.message || data.description || '',
              isRead: false
            };

            setNotifications(prev => [newNotif, ...prev]);

            // Display a beautiful custom floating popup using Toastify
            toast(
              <div className="flex flex-col gap-2" dir="rtl">
                <strong className="text-gray-900 text-lg font-extrabold flex items-center gap-2">
                  <span className="text-primary text-xl">✨</span> {newNotif.title}
                </strong>
                <span className="text-gray-700 text-sm leading-relaxed">{newNotif.description}</span>
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
