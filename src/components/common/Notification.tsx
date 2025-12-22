import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

interface NotificationProps {
  notification: Notification;
  onClose: (id: string) => void;
}

export function NotificationToast({ notification, onClose }: NotificationProps) {
  useEffect(() => {
    if (notification.duration !== 0) {
      const timer = setTimeout(() => {
        onClose(notification.id);
      }, notification.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [notification.id, notification.duration, onClose]);

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  const colors = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: 'text-green-600',
      title: 'text-green-800',
      message: 'text-green-700',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-red-600',
      title: 'text-red-800',
      message: 'text-red-700',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: 'text-yellow-600',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
    },
    info: {
      bg: 'bg-dl-grey-bg',
      border: 'border-dl-grey-medium',
      icon: 'text-dl-grey',
      title: 'text-dl-grey',
      message: 'text-dl-grey-light',
    },
  };

  const Icon = icons[notification.type];
  const colorScheme = colors[notification.type];

  return (
    <div
      className={`${colorScheme.bg} ${colorScheme.border} border-l-4 rounded-lg shadow-lg p-4 mb-3 min-w-[300px] max-w-[500px] animate-slide-in-right`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${colorScheme.icon} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold text-sm ${colorScheme.title} mb-1`}>
            {notification.title}
          </h4>
          {notification.message && (
            <p className={`text-sm ${colorScheme.message}`}>
              {notification.message}
            </p>
          )}
        </div>
        <button
          onClick={() => onClose(notification.id)}
          className={`${colorScheme.icon} hover:opacity-70 transition-opacity flex-shrink-0 touch-target`}
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}




