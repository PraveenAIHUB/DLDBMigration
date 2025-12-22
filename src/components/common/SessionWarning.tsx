import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

export function SessionWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Listen for session warning event
    const handleSessionWarning = (event: Event) => {
      const customEvent = event as CustomEvent;
      setMessage(customEvent.detail?.message || 'Your session will expire soon due to inactivity.');
      setShowWarning(true);
    };

    // Listen for session timeout event
    const handleSessionTimeout = (event: Event) => {
      const customEvent = event as CustomEvent;
      setMessage(customEvent.detail?.message || 'Your session has expired due to inactivity.');
      setShowTimeout(true);
      setShowWarning(false);
    };

    window.addEventListener('session-warning', handleSessionWarning);
    window.addEventListener('session-timeout', handleSessionTimeout);

    return () => {
      window.removeEventListener('session-warning', handleSessionWarning);
      window.removeEventListener('session-timeout', handleSessionTimeout);
    };
  }, []);

  if (showTimeout) {
    return (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{message}</p>
            </div>
            <button
              onClick={() => setShowTimeout(false)}
              className="ml-3 text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showWarning) {
    return (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg shadow-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">{message}</p>
              <p className="text-xs text-amber-700 mt-1">Move your mouse or press any key to extend your session.</p>
            </div>
            <button
              onClick={() => setShowWarning(false)}
              className="ml-3 text-amber-500 hover:text-amber-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

