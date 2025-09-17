import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

const FileUpload = ({ onFilesSelected, maxFiles = 5, maxSizePerFile = 10 * 1024 * 1024 }) => {
  const [uploadProgress, setUploadProgress] = useState({});
  const [previews, setPreviews] = useState([]);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(({ file, errors }) => ({
        fileName: file.name,
        errors: errors.map(e => e.message)
      }));
      console.error('File upload errors:', errors);
      // You could show these errors to the user
    }

    // Handle accepted files
    if (acceptedFiles.length > 0) {
      const newPreviews = acceptedFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      }));

      setPreviews(prev => [...prev, ...newPreviews]);
      onFilesSelected(newPreviews);
    }
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    maxFiles,
    maxSize: maxSizePerFile,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar']
    }
  });

  const removeFile = (fileId) => {
    setPreviews(prev => {
      const updated = prev.filter(p => p.id !== fileId);
      onFilesSelected(updated);
      return updated;
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('sheet')) return '📊';
    if (fileType.includes('zip') || fileType.includes('rar')) return '🗜️';
    return '📎';
  };

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive && !isDragReject
            ? 'border-blue-400 bg-blue-50'
            : isDragReject
            ? 'border-red-400 bg-red-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center space-y-2">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {isDragActive ? (
            <p className="text-blue-600">Drop files here...</p>
          ) : (
            <div>
              <p className="text-gray-600">Drag & drop files here, or click to select</p>
              <p className="text-sm text-gray-500 mt-1">
                Max {maxFiles} files, {formatFileSize(maxSizePerFile)} each
              </p>
            </div>
          )}
        </div>
      </div>

      {/* File Previews */}
      {previews.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Selected Files</h4>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {previews.map((preview) => (
              <div key={preview.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border">
                {/* File Preview/Icon */}
                <div className="flex-shrink-0">
                  {preview.preview ? (
                    <img 
                      src={preview.preview} 
                      alt={preview.name}
                      className="w-12 h-12 object-cover rounded border"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded border flex items-center justify-center text-2xl">
                      {getFileIcon(preview.type)}
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{preview.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(preview.size)}</p>
                  
                  {/* Upload Progress */}
                  {uploadProgress[preview.id] !== undefined && (
                    <div className="mt-1">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress[preview.id]}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{uploadProgress[preview.id]}% uploaded</p>
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeFile(preview.id)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;