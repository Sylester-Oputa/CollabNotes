import React, { useState } from 'react';
import FileUpload from './FileUpload';
import Button from '../ui/Button';

const FileAttachmentModal = ({ isOpen, onClose, onSend, recipientName }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (selectedFiles.length === 0 && !message.trim()) return;
    
    setUploading(true);
    try {
      await onSend(message.trim(), selectedFiles.map(f => f.file));
      // Reset form
      setSelectedFiles([]);
      setMessage('');
      onClose();
    } catch (error) {
      console.error('Failed to send message with attachments:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFiles([]);
    setMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Send files to {recipientName}
          </h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-96">
          {/* Message Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message to your files..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Files
            </label>
            <FileUpload
              onFilesSelected={setSelectedFiles}
              maxFiles={5}
              maxSizePerFile={10 * 1024 * 1024} // 10MB
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={(selectedFiles.length === 0 && !message.trim()) || uploading}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            {uploading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Sending...</span>
              </div>
            ) : (
              `Send ${selectedFiles.length > 0 ? `(${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''})` : ''}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FileAttachmentModal;
