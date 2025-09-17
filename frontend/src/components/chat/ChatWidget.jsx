import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useChatUsers } from '../../context/ChatUsersContext';
import Button from '../ui/Button';
import FileAttachmentModal from './FileAttachmentModal';
import MessageSearchModal from './MessageSearchModal';
import GroupChatModal from './GroupChatModal';
import EmojiPicker from './EmojiPicker';
import MessageReactions from './MessageReactions';
import MessageEditModal from './MessageEditModal';
import ThreadModal from './ThreadModal';
import ThreadIndicator from './ThreadIndicator';

const Tick = ({ delivered, readAt }) => {
  if (readAt) return <span className="text-blue-500" title="Read">✓✓</span>;
  if (delivered) return <span className="text-gray-400" title="Delivered">✓✓</span>;
  return <span className="text-gray-300" title="Sent">✓</span>;
};

const TypingIndicator = ({ userName }) => (
  <div className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-500">
    <div className="flex space-x-1">
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
    </div>
    <span>{userName} is typing...</span>
  </div>
);

const ChatWidget = ({ users: usersProp }) => {
  const { user } = useAuth();
  const { 
    connected, 
    onlineUserIds, 
    isOnline, 
    threads, 
    openThreadUserId, 
    minimized, 
    setMinimized, 
    openChat, 
    sendMessage, 
    markRead, 
    typingUsers, 
    startTyping, 
    stopTyping, 
    isUserTyping,
    // Group-related state and functions
    groups,
    groupThreads,
    openGroupId,
    openGroupChat,
    sendGroupMessage,
    loadGroupMessages,
    // Reactions and editing functions
    addReaction,
    editMessage,
    deleteMessage
  } = useChat();
  const [draft, setDraft] = useState('');
  const [showFileModal, setShowFileModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null); // messageId or null
  const [showEditModal, setShowEditModal] = useState(null); // message object or null
  const [editingMessage, setEditingMessage] = useState(false);
  const [showThreadModal, setShowThreadModal] = useState(null); // messageId or null
  const usersFromContext = useChatUsers();
  const users = usersProp && usersProp.length ? usersProp : usersFromContext || [];
  const messagesEndRef = useRef(null);
  const emojiButtonRef = useRef({});

  const conversations = useMemo(() => {
    // Direct message conversations
    const directChats = Object.keys(threads).map(uid => ({
      type: 'direct',
      userId: uid,
      lastMessage: threads[uid]?.messages?.[threads[uid].messages.length - 1],
    }));

    // Group conversations  
    const groupChats = Object.keys(groupThreads).map(groupId => ({
      type: 'group',
      groupId,
      group: groups.find(g => g.id === groupId),
      lastMessage: groupThreads[groupId]?.messages?.[groupThreads[groupId].messages.length - 1],
    }));

    // Combine and sort by last message time
    return [...directChats, ...groupChats].sort((a, b) => {
      const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bt - at;
    });
  }, [threads, groupThreads, groups]);

  const currentThread = openThreadUserId ? threads[openThreadUserId] : null;
  const currentGroup = openGroupId ? groups.find(g => g.id === openGroupId) : null;
  const currentGroupThread = openGroupId ? groupThreads[openGroupId] : null;
  const currentUserObj = users.find(u => u.id === openThreadUserId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentThread?.messages]);

  const handleSend = async () => {
    if (!draft.trim()) return;
    
    if (currentGroup) {
      const content = draft;
      setDraft('');
      try {
        await sendGroupMessage(currentGroup.id, content);
      } catch (e) {
        setDraft(content);
        console.error('Failed to send group message:', e);
      }
    } else if (openThreadUserId) {
      const recipient = users.find(u => u.id === openThreadUserId);
      if (!recipient) return;
      const content = draft;
      setDraft('');
      // Stop typing when sending
      stopTyping(openThreadUserId);
      try {
        await sendMessage(recipient, content);
      } catch (e) {
        // Optionally restore draft on failure
        setDraft(content);
        console.error('Failed to send message:', e);
      }
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setDraft(value);
    
    // Trigger typing indicators
    if (openThreadUserId && value.trim()) {
      startTyping(openThreadUserId);
    } else if (openThreadUserId) {
      stopTyping(openThreadUserId);
    }
  };

  const handleSendWithFiles = async (message, files) => {
    if (currentGroup) {
      try {
        await sendGroupMessage(currentGroup.id, message, files);
      } catch (e) {
        console.error('Failed to send group message with files:', e);
      }
    } else if (openThreadUserId) {
      const recipient = users.find(u => u.id === openThreadUserId);
      if (!recipient) return;
      
      const formData = new FormData();
      formData.append('recipientId', recipient.id);
      if (message) formData.append('content', message);
      formData.append('type', files.length > 0 ? 'FILE' : 'TEXT');
      
      files.forEach(file => {
        formData.append('attachments', file);
      });

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
        const response = await fetch(`${apiUrl}/messages-enhanced`, {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to send message with files');
        }
      } catch (e) {
        console.error('Failed to send message with files:', e);
      }
    }
  };

  const handleSearchMessageSelect = (message) => {
    // Open the chat with the user from the selected message
    if (message.recipientId) {
      // Direct message
      const otherUserId = message.senderId === user.id ? message.recipientId : message.senderId;
      const otherUser = users.find(u => u.id === otherUserId);
      if (otherUser) {
        openChat(otherUser);
        // Optionally scroll to the specific message (would need additional implementation)
      }
    } else if (message.groupId) {
      // Group message - would need group chat implementation
      console.log('Group message selected:', message);
    }
  };

  // Thread handlers
  const handleOpenThread = (messageId) => {
    setShowThreadModal(messageId);
  };

  const handleCloseThread = () => {
    setShowThreadModal(null);
  };

  // Message reaction handlers
  const handleEmojiSelect = async (emoji, messageId) => {
    try {
      await addReaction(messageId, emoji);
      setShowEmojiPicker(null);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  // Message editing handlers
  const handleEditMessage = async (messageId, newContent) => {
    try {
      setEditingMessage(true);
      await editMessage(messageId, newContent);
      setShowEditModal(null);
    } catch (error) {
      console.error('Error editing message:', error);
    } finally {
      setEditingMessage(false);
    }
  };

  const canEditMessage = (message) => {
    if (!user || message.senderId !== user.id) return false;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return new Date(message.createdAt) > twentyFourHoursAgo && !message.deletedAt;
  };

  const unreadForMe = (threadId, isGroup = false) => {
    const thread = isGroup ? groupThreads[threadId] : threads[threadId];
    if (!thread) return false;
    
    const msgList = thread.messages || [];
    return msgList.some(m => {
      if (isGroup) {
        // For groups, check if message is not from current user and not read
        return m.senderId !== user.id && !m.readAt;
      } else {
        // For direct messages, check if message is for current user and not read
        return m.recipientId === user.id && !m.readAt;
      }
    });
  };

  // Don't render if user is not authenticated
  if (!user?.id) {
    return null;
  }

  return (
    <div className="fixed right-6 bottom-6 z-50">
      {minimized ? (
        <button 
          onClick={() => setMinimized(false)} 
          className="group relative bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {connected && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
          )}
          {/* Unread badge */}
          {conversations.some(c => {
            if (c.type === 'group') {
              return unreadForMe(c.groupId, true);
            } else {
              return unreadForMe(c.userId, false);
            }
          }) && (
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">
                {conversations.filter(c => {
                  if (c.type === 'group') {
                    return unreadForMe(c.groupId, true);
                  } else {
                    return unreadForMe(c.userId, false);
                  }
                }).length}
              </span>
            </div>
          )}
        </button>
      ) : (
        <div className="w-96 h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden backdrop-blur-sm">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {connected && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg">Messages</h3>
                <p className="text-blue-100 text-sm">{connected ? 'Connected' : 'Connecting...'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setShowGroupModal(true)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Create group"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>
              <button 
                onClick={() => setShowSearchModal(true)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Search messages"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button 
                onClick={() => setMinimized(true)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button 
                onClick={() => setMinimized(true)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Left Sidebar */}
            <div className="w-32 bg-gray-50 border-r border-gray-200 flex flex-col">
              {/* Online Users */}
              <div className="p-3 border-b border-gray-200">
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Online</h4>
                <div className="space-y-2 max-h-24 overflow-y-auto">
                  {users.filter(u => u.id !== user.id && isOnline(u.id)).map(u => (
                    <button 
                      key={u.id} 
                      className={`w-full flex flex-col items-center p-2 rounded-lg hover:bg-blue-50 transition-colors ${openThreadUserId === u.id ? 'bg-blue-100 ring-2 ring-blue-200' : ''}`} 
                      onClick={() => openChat(u)}
                    >
                      <div className="relative mb-1">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
                        {isUserTyping(u.id) && (
                          <div className="absolute -top-1 -left-1 w-3 h-3">
                            <div className="w-full h-full bg-yellow-400 rounded-full animate-pulse flex items-center justify-center">
                              <span className="text-xs">✏️</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-700 truncate w-full text-center">{u.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Conversations */}
              <div className="flex-1 p-3">
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Chats</h4>
                <div className="space-y-1">
                  {conversations.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-4">No chats yet</div>
                  )}
                  {conversations.slice(0, 4).map(c => {
                    if (c.type === 'group') {
                      const group = c.group;
                      if (!group) return null;
                      
                      return (
                        <button 
                          key={`group-${c.groupId}`} 
                          className={`w-full flex flex-col items-center p-2 rounded-lg hover:bg-blue-50 transition-colors ${openGroupId === c.groupId ? 'bg-blue-100 ring-2 ring-blue-200' : ''}`} 
                          onClick={() => openGroupChat(group)}
                        >
                          <div className="relative mb-1">
                            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                              {group.name.charAt(0).toUpperCase()}
                            </div>
                            {unreadForMe(c.groupId, true) && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-700 truncate w-full text-center">{group.name.split(' ')[0]}</span>
                        </button>
                      );
                    } else {
                      const chatUser = users.find(u => u.id === c.userId);
                      if (!chatUser) return null;
                      
                      return (
                        <button 
                          key={`direct-${c.userId}`} 
                          className={`w-full flex flex-col items-center p-2 rounded-lg hover:bg-blue-50 transition-colors ${openThreadUserId === c.userId ? 'bg-blue-100 ring-2 ring-blue-200' : ''}`} 
                          onClick={() => openChat(chatUser)}
                        >
                          <div className="relative mb-1">
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                              {chatUser.name.charAt(0).toUpperCase()}
                            </div>
                            {isOnline(chatUser.id) && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
                            )}
                            {unreadForMe(c.userId, false) && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                            {isUserTyping(chatUser.id) && (
                              <div className="absolute -top-1 -left-1 w-3 h-3">
                                <div className="w-full h-full bg-yellow-400 rounded-full animate-pulse flex items-center justify-center">
                                  <span className="text-xs">✏️</span>
                                </div>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-700 truncate w-full text-center">{chatUser.name.split(' ')[0]}</span>
                        </button>
                      );
                    }
                  })}
                </div>
              </div>
            </div>
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-white">
              {(currentUserObj || currentGroup) ? (
                <>
                  {/* Chat Header */}
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className={`w-10 h-10 ${currentGroup ? 'bg-gradient-to-br from-green-400 to-emerald-600' : 'bg-gradient-to-br from-blue-400 to-purple-500'} rounded-full flex items-center justify-center text-white font-medium`}>
                          {currentGroup ? currentGroup.name.charAt(0).toUpperCase() : currentUserObj.name.charAt(0).toUpperCase()}
                        </div>
                        {currentUserObj && isOnline(currentUserObj.id) && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {currentGroup ? currentGroup.name : currentUserObj.name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {currentGroup ? (
                            <span>{currentGroup.members?.length || 0} members</span>
                          ) : (
                            isOnline(currentUserObj.id) ? (
                              <span className="flex items-center">
                                <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                                Active now
                              </span>
                            ) : (
                              'Offline'
                            )
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50/30 to-transparent">
                    {(currentThread?.messages?.length === 0 || currentGroupThread?.messages?.length === 0) ? (
                      <div className="text-center text-gray-500 mt-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <p className="text-sm">
                          {currentGroup ? `Start a conversation in ${currentGroup.name}` : `Start a conversation with ${currentUserObj.name}`}
                        </p>
                      </div>
                    ) : (
                      (currentGroup ? currentGroupThread?.messages : currentThread?.messages)?.map((m, index) => {
                        const mine = m.senderId === user.id;
                        const messageThread = currentGroup ? currentGroupThread : currentThread;
                        const showAvatar = index === 0 || messageThread.messages[index - 1]?.senderId !== m.senderId;
                        const sender = currentGroup && !mine ? users.find(u => u.id === m.senderId) : null;
                        
                        return (
                          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-4' : 'mt-1'}`}>
                            <div className={`flex items-end space-x-2 max-w-xs ${mine ? 'flex-row-reverse space-x-reverse' : ''}`}>
                              {!mine && showAvatar && (
                                <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                                  {currentGroup && sender ? sender.name.charAt(0).toUpperCase() : currentUserObj.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              {!mine && !showAvatar && <div className="w-8 h-8 flex-shrink-0"></div>}
                              
                              <div className={`group ${mine ? 'text-right' : 'text-left'}`}>
                                {currentGroup && !mine && showAvatar && (
                                  <div className="text-xs text-gray-500 mb-1 px-1">
                                    {sender?.name || 'Unknown User'}
                                  </div>
                                )}
                                <div className={`inline-block px-4 py-2 rounded-2xl text-sm ${
                                  mine 
                                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-md' 
                                    : 'bg-gray-100 text-gray-900 rounded-bl-md border border-gray-200'
                                }`}>
                                  <p className="whitespace-pre-wrap break-words">
                                    {m.isDeleted ? '[Message deleted]' : m.content}
                                    {m.editedAt && !m.isDeleted && (
                                      <span className="text-xs opacity-75 ml-2">(edited)</span>
                                    )}
                                  </p>
                                </div>

                                {/* File attachments */}
                                {m.attachments && m.attachments.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {m.attachments.map(attachment => (
                                      <div key={attachment.id} className="text-xs">
                                        <a 
                                          href={attachment.fileUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-blue-500 hover:text-blue-600 underline"
                                        >
                                          📎 {attachment.fileName}
                                        </a>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Message reactions */}
                                {m.reactions && m.reactions.length > 0 && (
                                  <MessageReactions
                                    reactions={m.reactions}
                                    onReactionClick={(emoji) => handleEmojiSelect(emoji, m.id)}
                                    onShowPicker={() => setShowEmojiPicker(showEmojiPicker === m.id ? null : m.id)}
                                  />
                                )}

                                {/* Thread indicator */}
                                {!m.parentId && (
                                  <ThreadIndicator 
                                    messageId={m.id} 
                                    onOpenThread={handleOpenThread}
                                  />
                                )}

                                {/* Message actions (on hover) */}
                                <div className={`opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex items-center space-x-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                                  <button 
                                    className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors"
                                    onClick={() => setShowEmojiPicker(showEmojiPicker === m.id ? null : m.id)}
                                    title="Add reaction"
                                  >
                                    😊
                                  </button>
                                  <button 
                                    className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors"
                                    onClick={() => handleOpenThread(m.id)}
                                    title="Reply in thread"
                                  >
                                    💬
                                  </button>
                                  {canEditMessage(m) && (
                                    <button 
                                      className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors"
                                      onClick={() => setShowEditModal(m)}
                                      title="Edit message"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                </div>

                                {/* Emoji picker */}
                                {showEmojiPicker === m.id && (
                                  <div className="relative">
                                    <EmojiPicker
                                      onEmojiSelect={(emoji) => handleEmojiSelect(emoji, m.id)}
                                      onClose={() => setShowEmojiPicker(null)}
                                    />
                                  </div>
                                )}
                                
                                <div className={`flex items-center mt-1 space-x-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                                  <span className="text-xs text-gray-400">
                                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {mine && (
                                    <Tick delivered={m.delivered || !!m.readAt} readAt={m.readAt} />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    
                    {/* Typing Indicator */}
                    {((openThreadUserId && isUserTyping(openThreadUserId)) || (currentGroup && typingUsers.some(tu => tu.groupId === currentGroup.id))) && (
                      <TypingIndicator 
                        userName={
                          currentGroup 
                            ? typingUsers.find(tu => tu.groupId === currentGroup.id)?.userName || 'Someone'
                            : currentUserObj?.name || 'Someone'
                        } 
                      />
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 border-t border-gray-200 bg-white">
                    <div className="flex items-end space-x-3">
                      <button
                        onClick={() => setShowFileModal(true)}
                        className="flex-shrink-0 p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                        title="Attach files"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </button>
                      
                      <div className="flex-1 relative">
                        <input 
                          className="w-full border border-gray-300 rounded-full px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder-gray-400" 
                          placeholder={currentGroup ? `Message ${currentGroup.name}...` : `Message ${currentUserObj.name}...`}
                          value={draft} 
                          onChange={handleInputChange} 
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }} 
                          autoComplete="off"
                        />
                        <button 
                          onClick={handleSend} 
                          disabled={!draft.trim()}
                          className={`absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            draft.trim() 
                              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-lg' 
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* No User Selected */
                <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-2M5 12V6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to Chat</h3>
                    <p className="text-gray-500 text-sm max-w-xs">Select a team member to start a conversation or see who's online</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Attachment Modal */}
      <FileAttachmentModal
        isOpen={showFileModal}
        onClose={() => setShowFileModal(false)}
        onSend={handleSendWithFiles}
        recipientName={currentGroup ? currentGroup.name : (currentUserObj?.name || 'Unknown')}
      />

      {/* Group Chat Modal */}
      <GroupChatModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        users={users}
      />

      {/* Message Search Modal */}
      <MessageSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectMessage={handleSearchMessageSelect}
      />

      {/* Thread Modal */}
      {showThreadModal && (
        <ThreadModal
          messageId={showThreadModal}
          isOpen={!!showThreadModal}
          onClose={handleCloseThread}
        />
      )}

      {/* Message Edit Modal */}
      {showEditModal && (
        <MessageEditModal
          message={showEditModal}
          onEdit={handleEditMessage}
          onClose={() => setShowEditModal(null)}
        />
      )}
    </div>
  );
};

export default ChatWidget;
