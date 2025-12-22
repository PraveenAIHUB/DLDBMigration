import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'warning',
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const colors = {
    danger: {
      button: 'btn-primary',
      icon: 'text-dl-red',
    },
    warning: {
      button: 'bg-dl-yellow hover:bg-dl-yellow-hover text-white font-semibold px-6 py-3 rounded-dl-sm transition-all',
      icon: 'text-dl-yellow',
    },
    info: {
      button: 'bg-dl-grey hover:bg-dl-grey/90 text-white font-semibold px-6 py-3 rounded-dl-sm transition-all',
      icon: 'text-dl-grey',
    },
  };

  const colorScheme = colors[type];

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-[10000] p-4">
      <div className="modal-dl max-w-md w-full animate-scale-in">
        <div className="flex items-start gap-4 mb-6">
          <div className={`${colorScheme.icon} flex-shrink-0`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-dl-grey mb-2">{title}</h3>
            <p className="text-sm text-dl-grey-light">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-dl-grey-light hover:text-dl-grey transition-colors touch-target"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onCancel}
            className="btn-secondary touch-target"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`${colorScheme.button} touch-target`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}




