import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChatUsers } from '../../context/ChatUsersContext';
import Button from '../ui/Button';

const MessageSearchModal = ({ isOpen, onClose, onSelectMessage }) => {
  const { user } = useAuth();
  const users = useChatUsers();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all'); // all, direct, group
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const searchTimeoutRef = useRef(null);

  const limit = 20;

  // Debounced search
  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(true);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, type, selectedUser, selectedGroup, isOpen]);

  const performSearch = async (reset = false) => {
    if (!query.trim()) return;

    setLoading(true);
    const searchOffset = reset ? 0 : offset;

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        type,
        limit: limit.toString(),
        offset: searchOffset.toString()
      });

      if (type === 'direct' && selectedUser) {
        params.append('userId', selectedUser);
      }
      if (type === 'group' && selectedGroup) {
        params.append('groupId', selectedGroup);
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
      const response = await fetch(`${apiUrl}/messages-enhanced/search?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      
      if (reset) {
        setSearchResults(data.messages);
        setOffset(data.messages.length);
      } else {
        setSearchResults(prev => [...prev, ...data.messages]);
        setOffset(prev => prev + data.messages.length);
      }
      
      setHasMore(data.messages.length === limit && data.total > offset + data.messages.length);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      performSearch(false);
    }
  };

  const handleClose = () => {
    setQuery('');
    setType('all');
    setSelectedUser('');
    setSelectedGroup('');
    setSearchResults([]);
    setOffset(0);
    setHasMore(false);
    onClose();
  };

  const handleSelectMessage = (message) => {
    onSelectMessage(message);
    handleClose();
  };

  const formatMessagePreview = (content, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const highlightQuery = (text, query) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Search Messages</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Controls */}
        <div className="px-6 py-4 border-b border-gray-200 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {loading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            {/* Message Type */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Type:</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All messages</option>
                <option value="direct">Direct messages</option>
                <option value="group">Group messages</option>
              </select>
            </div>

            {/* User Filter for Direct Messages */}
            {type === 'direct' && (
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">With:</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any user</option>
                  {users.filter(u => u.id !== user.id).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Group Filter for Group Messages */}
            {type === 'group' && (
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">In group:</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any group</option>
                  {/* Groups will be populated from context or API */}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto max-h-96">
          {searchResults.length === 0 && !loading && query.trim() && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No messages found</p>
              <p className="text-sm">Try different search terms</p>
            </div>
          )}

          {searchResults.length === 0 && !loading && !query.trim() && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p>Start typing to search messages</p>
            </div>
          )}

          <div className="divide-y divide-gray-200">
            {searchResults.map((message) => {
              const sender = users.find(u => u.id === message.senderId) || { name: 'Unknown User' };
              const recipient = message.recipientId ? users.find(u => u.id === message.recipientId) : null;
              
              return (
                <button
                  key={message.id}
                  onClick={() => handleSelectMessage(message)}
                  className="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                      {sender.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-gray-900">{sender.name}</span>
                        {message.groupId ? (
                          <span className="text-sm text-gray-500">in {message.group?.name || 'group'}</span>
                        ) : recipient ? (
                          <span className="text-sm text-gray-500">to {recipient.name}</span>
                        ) : null}
                        <span className="text-xs text-gray-400">
                          {new Date(message.createdAt).toLocaleDateString()} {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      <p 
                        className="text-gray-700 text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ 
                          __html: highlightQuery(formatMessagePreview(message.content), query) 
                        }}
                      />

                      {/* File attachments indicator */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 flex items-center text-xs text-gray-500">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          {message.attachments.length} file{message.attachments.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="px-6 py-4 border-t border-gray-200">
              <Button
                onClick={loadMore}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                {loading ? 'Loading...' : 'Load more results'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageSearchModal;