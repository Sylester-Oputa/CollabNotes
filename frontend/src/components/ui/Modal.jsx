import { useEffect } from 'react';
import Button from './Button';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  onConfirm, 
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  size = 'md'
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
      onClick={handleBackdropClick}
    >
      <div 
        className={`bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {children}
        </div>

        {/* Footer with action buttons */}
        {(onConfirm || onCancel) && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
            {onCancel && (
              <Button
                onClick={onCancel}
                variant="secondary"
              >
                {cancelText}
              </Button>
            )}
            {onConfirm && (
              <Button
                onClick={onConfirm}
                variant={confirmVariant}
              >
                {confirmText}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Confirmation Modal Component
export const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      confirmText={confirmText}
      cancelText={cancelText}
      confirmVariant={variant}
      size="sm"
    >
      <p className="text-gray-600">{message}</p>
    </Modal>
  );
};

export default Modal;