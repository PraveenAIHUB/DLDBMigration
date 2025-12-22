import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Notification, NotificationType } from '../components/common/Notification';
import { NotificationContainer } from '../components/common/NotificationContainer';

interface NotificationContextType {
  showNotification: (type: NotificationType, title: string, message?: string, duration?: number) => void;
  showSuccess: (title: string, message?: string, duration?: number) => void;
  showError: (title: string, message?: string, duration?: number) => void;
  showWarning: (title: string, message?: string, duration?: number) => void;
  showInfo: (title: string, message?: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback(
    (type: NotificationType, title: string, message?: string, duration: number = 5000) => {
      const id = `notification-${Date.now()}-${Math.random()}`;
      const notification: Notification = {
        id,
        type,
        title,
        message,
        duration,
      };

      setNotifications((prev) => [...prev, notification]);
    },
    []
  );

  const showSuccess = useCallback(
    (title: string, message?: string, duration?: number) => {
      showNotification('success', title, message, duration);
    },
    [showNotification]
  );

  const showError = useCallback(
    (title: string, message?: string, duration?: number) => {
      showNotification('error', title, message, duration || 7000);
    },
    [showNotification]
  );

  const showWarning = useCallback(
    (title: string, message?: string, duration?: number) => {
      showNotification('warning', title, message, duration);
    },
    [showNotification]
  );

  const showInfo = useCallback(
    (title: string, message?: string, duration?: number) => {
      showNotification('info', title, message, duration);
    },
    [showNotification]
  );

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
      }}
    >
      {children}
      <NotificationContainer notifications={notifications} onClose={removeNotification} />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

