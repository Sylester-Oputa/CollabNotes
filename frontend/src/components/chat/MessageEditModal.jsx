import React, { useState, useRef, useEffect } from 'react';
import Button from '../ui/Button';

const MessageEditModal = ({ isOpen, onClose, onSave, message, loading = false }) => {
  const [editedContent, setEditedContent] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen && message) {
      setEditedContent(message.content || '');
      // Focus textarea after a short delay to ensure modal is rendered
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
        }
      }, 100);
    }
  }, [isOpen, message]);

  const handleSave = () => {
    if (editedContent.trim() && editedContent.trim() !== message?.content) {
      onSave(message.id, editedContent.trim());
    }
  };

  const handleCancel = () => {
    setEditedContent(message?.content || '');
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (!isOpen || !message) return null;

  const hasChanges = editedContent.trim() !== message.content;
  const isEmpty = !editedContent.trim();

  // Calculate time since message was created
  const messageAge = Date.now() - new Date(message.createdAt).getTime();
  const hoursOld = Math.floor(messageAge / (1000 * 60 * 60));
  const canEdit = hoursOld < 24; // 24 hour edit limit

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Edit Message</h3>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!canEdit ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Cannot Edit Message</h4>
              <p className="text-gray-600">
                Messages can only be edited within 24 hours of posting. This message is {hoursOld} hours old.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label htmlFor="message-edit" className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  ref={textareaRef}
                  id="message-edit"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Edit your message..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={loading}
                  maxLength={5000}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">
                    {editedContent.length}/5000 characters
                  </span>
                  <span className="text-xs text-gray-500">
                    Ctrl+Enter to save, Esc to cancel
                  </span>
                </div>
              </div>

              {message.editedAt && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-yellow-800">
                      This message was last edited on {new Date(message.editedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {canEdit && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
            <Button
              onClick={handleCancel}
              variant="outline"
              disabled={loading}
            >
              Cancel
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isEmpty || loading}
              loading={loading}
            >
              Save Changes
            </Button>
          </div>
        )}

        {!canEdit && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end">
            <Button onClick={handleCancel} variant="outline">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageEditModal;