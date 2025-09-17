import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { messages as messagesAPI, reactions, messageEditing, threads } from '../utils/api';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [threads, setThreads] = useState({}); // userId -> { messages: [], hasMore: false }
  const [groupThreads, setGroupThreads] = useState({}); // groupId -> { messages: [], hasMore: false, group: {} }
  const [groups, setGroups] = useState([]); // user's groups
  const [openThreadUserId, setOpenThreadUserId] = useState(null);
  const [openGroupId, setOpenGroupId] = useState(null);
  const [minimized, setMinimized] = useState(true);
  const [typingUsers, setTypingUsers] = useState({}); // userId -> true
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Connect socket
  useEffect(() => {
    if (!user?.id) return;
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5001';
    const socket = io(baseUrl, { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('auth', user.id);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('presence:initial', ({ onlineUserIds }) => setOnlineUserIds(onlineUserIds));
    socket.on('presence:update', ({ userId, online }) => {
      setOnlineUserIds((prev) => {
        const set = new Set(prev);
        if (online) set.add(userId); else set.delete(userId);
        return Array.from(set);
      });
    });

    // Typing indicators
    socket.on('typing:start', ({ userId }) => {
      setTypingUsers(prev => ({ ...prev, [userId]: true }));
    });
    socket.on('typing:stop', ({ userId }) => {
      setTypingUsers(prev => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
    });

    // Group events
    socket.on('group:created', ({ group }) => {
      setGroups(prev => [group, ...prev]);
    });

    socket.on('group:updated', ({ group }) => {
      setGroups(prev => prev.map(g => g.id === group.id ? group : g));
    });

    socket.on('group:memberAdded', ({ groupId, newMembers, group }) => {
      setGroups(prev => prev.map(g => g.id === groupId ? group : g));
    });

    socket.on('group:memberRemoved', ({ groupId, removedUserId }) => {
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            members: g.members.filter(m => m.userId !== removedUserId)
          };
        }
        return g;
      }));
    });

    socket.on('group:removedFromGroup', ({ groupId }) => {
      setGroups(prev => prev.filter(g => g.id !== groupId));
      // Close group if currently open
      setOpenGroupId(current => current === groupId ? null : current);
    });
    socket.on('message:delivered', ({ messageId }) => {
      // We can flag delivered by local lookup if needed
      setThreads((prev) => {
        const updated = { ...prev };
        for (const uid of Object.keys(updated)) {
          updated[uid] = {
            ...updated[uid],
            messages: updated[uid]?.messages?.map(m => m.id === messageId ? { ...m, delivered: true } : m) || []
          };
        }
        return updated;
      });
    });
    socket.on('message:read', ({ messageId, readAt }) => {
      setThreads((prev) => {
        const updated = { ...prev };
        for (const uid of Object.keys(updated)) {
          updated[uid] = {
            ...updated[uid],
            messages: updated[uid]?.messages?.map(m => m.id === messageId ? { ...m, readAt } : m) || []
          };
        }
        return updated;
      });
    });

    // Incoming new message handler
    const handleNewMessage = ({ message }) => {
      if (!message) return;
      
      if (message.groupId) {
        // Group message
        setGroupThreads((prev) => {
          const current = prev[message.groupId]?.messages || [];
          return {
            ...prev,
            [message.groupId]: {
              messages: [...current, message],
              hasMore: prev[message.groupId]?.hasMore || false,
              group: prev[message.groupId]?.group || groups.find(g => g.id === message.groupId)
            }
          };
        });
      } else {
        // Direct message
        const otherUserId = message.senderId;
        setThreads((prev) => {
          const current = prev[otherUserId]?.messages || [];
          return {
            ...prev,
            [otherUserId]: {
              messages: [...current, message],
              hasMore: prev[otherUserId]?.hasMore || false,
            }
          };
        });
      }
      
      // Emit delivered ack to sender
      socket.emit('message:delivered', { messageId: message.id, userId: user.id });
      
      // If this thread is currently open and focused, mark as read
      if (message.groupId) {
        setOpenGroupId((currentOpenGroup) => {
          if (currentOpenGroup === message.groupId) {
            messagesAPI.markRead(message.id).catch(() => {});
            socket.emit('message:read', { messageId: message.id, userId: user.id });
          }
          return currentOpenGroup;
        });
      } else {
        setOpenThreadUserId((currentOpenThread) => {
          if (currentOpenThread === message.senderId) {
            messagesAPI.markRead(message.id).catch(() => {});
            // local optimistic read; server will emit read as well
            setThreads((prev) => {
              const current = prev[message.senderId]?.messages || [];
              return {
                ...prev,
                [message.senderId]: {
                  messages: current.map(m => m.id === message.id ? { ...m, readAt: new Date().toISOString() } : m),
                  hasMore: prev[message.senderId]?.hasMore || false,
                }
              };
            });
            socket.emit('message:read', { messageId: message.id, userId: user.id });
          }
          return currentOpenThread;
        });
      }
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  const isOnline = (userId) => onlineUserIds.includes(userId);

  const openChat = async (otherUser) => {
    if (!otherUser?.id) return;
    setOpenThreadUserId(otherUser.id);
    setMinimized(false);
    // lazy load thread if not present
    if (!threads[otherUser.id]) {
      try {
        const res = await messagesAPI.getThread(otherUser.id);
        setThreads((prev) => ({ ...prev, [otherUser.id]: { messages: res.data.messages || [], hasMore: false } }));
        
        // Mark any unread messages in this thread as read
        const unreadMessages = (res.data.messages || []).filter(m => m.recipientId === user.id && !m.readAt);
        for (const msg of unreadMessages) {
          try {
            await messagesAPI.markRead(msg.id);
            socketRef.current?.emit('message:read', { messageId: msg.id, userId: user.id });
          } catch (e) {
            console.error('Failed to mark message as read:', e);
          }
        }
        
        // Update local state to mark these as read
        if (unreadMessages.length > 0) {
          setThreads((prev) => ({
            ...prev,
            [otherUser.id]: {
              messages: (prev[otherUser.id]?.messages || []).map(m => 
                unreadMessages.some(um => um.id === m.id) 
                  ? { ...m, readAt: new Date().toISOString() }
                  : m
              ),
              hasMore: false
            }
          }));
        }
      } catch (e) {
        console.error('Failed to load thread', e);
        // You could show a toast error here if desired
      }
    } else {
      // Mark any unread messages in existing thread as read
      const unreadMessages = threads[otherUser.id]?.messages?.filter(m => m.recipientId === user.id && !m.readAt) || [];
      for (const msg of unreadMessages) {
        try {
          await messagesAPI.markRead(msg.id);
          socketRef.current?.emit('message:read', { messageId: msg.id, userId: user.id });
        } catch (e) {
          console.error('Failed to mark message as read:', e);
        }
      }
      
      // Update local state
      if (unreadMessages.length > 0) {
        setThreads((prev) => ({
          ...prev,
          [otherUser.id]: {
            ...prev[otherUser.id],
            messages: (prev[otherUser.id]?.messages || []).map(m => 
              unreadMessages.some(um => um.id === m.id) 
                ? { ...m, readAt: new Date().toISOString() }
                : m
            )
          }
        }));
      }
    }
  };

  const sendMessage = async (recipient, content) => {
    if (!recipient?.id || !content?.trim()) return;
    // optimistic add
    const tempId = `tmp-${Date.now()}`;
    setThreads((prev) => {
      const current = prev[recipient.id]?.messages || [];
      return {
        ...prev,
        [recipient.id]: {
          messages: [...current, { id: tempId, content: content.trim(), senderId: user.id, recipientId: recipient.id, companyId: user.companyId, createdAt: new Date().toISOString(), readAt: null, optimistic: true }],
          hasMore: prev[recipient.id]?.hasMore || false,
        }
      };
    });
    try {
      const res = await messagesAPI.send(recipient.id, content.trim());
      setThreads((prev) => {
        const current = prev[recipient.id]?.messages || [];
        return {
          ...prev,
          [recipient.id]: {
            messages: current.map(m => m.id === tempId ? res.data : m),
            hasMore: prev[recipient.id]?.hasMore || false,
          }
        };
      });
    } catch (e) {
      console.error('Send failed', e);
      // rollback optimistic
      setThreads((prev) => {
        const current = prev[recipient.id]?.messages || [];
        return {
          ...prev,
          [recipient.id]: {
            messages: current.filter(m => m.id !== tempId),
            hasMore: prev[recipient.id]?.hasMore || false,
          }
        };
      });
      throw e;
    }
  };

  const markRead = async (otherUserId, messageId) => {
    try {
      await messagesAPI.markRead(messageId);
      // local update; server will also emit
      setThreads((prev) => {
        const current = prev[otherUserId]?.messages || [];
        return {
          ...prev,
          [otherUserId]: {
            messages: current.map(m => m.id === messageId ? { ...m, readAt: new Date().toISOString() } : m),
            hasMore: prev[otherUserId]?.hasMore || false,
          }
        };
      });
      // also emit socket read event
      socketRef.current?.emit('message:read', { messageId, userId: user.id });
    } catch (e) {
      console.error('Read mark failed', e);
    }
  };

  // Typing indicator functions
  const startTyping = (recipientId) => {
    if (!socketRef.current || !recipientId) return;
    socketRef.current.emit('typing:start', { recipientId });
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Auto-stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(recipientId);
    }, 3000);
  };

  const stopTyping = (recipientId) => {
    if (!socketRef.current || !recipientId) return;
    socketRef.current.emit('typing:stop', { recipientId });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const isUserTyping = (userId) => {
    return !!typingUsers[userId];
  };

  // Group functions
  const openGroupChat = (group) => {
    setOpenThreadUserId(null);
    setOpenGroupId(group.id);
    setMinimized(false);
    
    // Load group messages if not already loaded
    if (!groupThreads[group.id]?.messages?.length) {
      loadGroupMessages(group.id);
    }
  };

  const loadGroupMessages = async (groupId) => {
    try {
      const res = await messagesAPI.getGroupMessages(groupId);
      setGroupThreads((prev) => ({
        ...prev,
        [groupId]: {
          messages: res.data || [],
          hasMore: false,
          group: groups.find(g => g.id === groupId)
        }
      }));
    } catch (e) {
      console.error('Failed to load group messages', e);
    }
  };

  const sendGroupMessage = async (group, content) => {
    const tempId = 'temp-' + Date.now();
    
    // Optimistic update
    setGroupThreads((prev) => {
      const current = prev[group.id]?.messages || [];
      return {
        ...prev,
        [group.id]: {
          messages: [...current, { 
            id: tempId, 
            content: content.trim(), 
            senderId: user.id, 
            groupId: group.id,
            companyId: user.companyId, 
            createdAt: new Date().toISOString(), 
            optimistic: true 
          }],
          hasMore: prev[group.id]?.hasMore || false,
          group: prev[group.id]?.group || group
        }
      };
    });

    try {
      const res = await messagesAPI.sendGroupMessage(group.id, content.trim());
      setGroupThreads((prev) => {
        const current = prev[group.id]?.messages || [];
        return {
          ...prev,
          [group.id]: {
            messages: current.map(m => m.id === tempId ? res.data : m),
            hasMore: prev[group.id]?.hasMore || false,
            group: prev[group.id]?.group || group
          }
        };
      });
    } catch (e) {
      console.error('Send group message failed', e);
      // rollback optimistic
      setGroupThreads((prev) => {
        const current = prev[group.id]?.messages || [];
        return {
          ...prev,
          [group.id]: {
            messages: current.filter(m => m.id !== tempId),
            hasMore: prev[group.id]?.hasMore || false,
            group: prev[group.id]?.group || group
          }
        };
      });
      throw e;
    }
  };

  // Message reactions and editing functionality
  const addReaction = async (messageId, emoji) => {
    try {
      const response = await reactions.addReaction(messageId, emoji);
      
      // Update local state for direct messages
      setThreads(prev => {
        const newThreads = { ...prev };
        Object.keys(newThreads).forEach(threadId => {
          if (newThreads[threadId].messages) {
            newThreads[threadId].messages = newThreads[threadId].messages.map(msg => {
              if (msg.id === messageId) {
                return {
                  ...msg,
                  reactions: response.data.reactionSummary || []
                };
              }
              return msg;
            });
          }
        });
        return newThreads;
      });

      // Update local state for group messages
      setGroupThreads(prev => {
        const newGroupThreads = { ...prev };
        Object.keys(newGroupThreads).forEach(groupId => {
          if (newGroupThreads[groupId].messages) {
            newGroupThreads[groupId].messages = newGroupThreads[groupId].messages.map(msg => {
              if (msg.id === messageId) {
                return {
                  ...msg,
                  reactions: response.data.reactionSummary || []
                };
              }
              return msg;
            });
          }
        });
        return newGroupThreads;
      });

      return response.data;
    } catch (error) {
      console.error('Failed to add reaction:', error);
      throw error;
    }
  };

  const editMessage = async (messageId, newContent) => {
    try {
      const response = await messageEditing.editMessage(messageId, newContent);
      
      // Update local state for direct messages
      setThreads(prev => {
        const newThreads = { ...prev };
        Object.keys(newThreads).forEach(threadId => {
          if (newThreads[threadId].messages) {
            newThreads[threadId].messages = newThreads[threadId].messages.map(msg => {
              if (msg.id === messageId) {
                return {
                  ...msg,
                  content: newContent,
                  editedAt: new Date().toISOString(),
                  isEdited: true
                };
              }
              return msg;
            });
          }
        });
        return newThreads;
      });

      // Update local state for group messages
      setGroupThreads(prev => {
        const newGroupThreads = { ...prev };
        Object.keys(newGroupThreads).forEach(groupId => {
          if (newGroupThreads[groupId].messages) {
            newGroupThreads[groupId].messages = newGroupThreads[groupId].messages.map(msg => {
              if (msg.id === messageId) {
                return {
                  ...msg,
                  content: newContent,
                  editedAt: new Date().toISOString(),
                  isEdited: true
                };
              }
              return msg;
            });
          }
        });
        return newGroupThreads;
      });

      return response.data;
    } catch (error) {
      console.error('Failed to edit message:', error);
      throw error;
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      const response = await messageEditing.deleteMessage(messageId);
      
      // Update local state for direct messages
      setThreads(prev => {
        const newThreads = { ...prev };
        Object.keys(newThreads).forEach(threadId => {
          if (newThreads[threadId].messages) {
            newThreads[threadId].messages = newThreads[threadId].messages.map(msg => {
              if (msg.id === messageId) {
                return {
                  ...msg,
                  content: '[Message deleted]',
                  deletedAt: new Date().toISOString(),
                  isDeleted: true
                };
              }
              return msg;
            });
          }
        });
        return newThreads;
      });

      // Update local state for group messages
      setGroupThreads(prev => {
        const newGroupThreads = { ...prev };
        Object.keys(newGroupThreads).forEach(groupId => {
          if (newGroupThreads[groupId].messages) {
            newGroupThreads[groupId].messages = newGroupThreads[groupId].messages.map(msg => {
              if (msg.id === messageId) {
                return {
                  ...msg,
                  content: '[Message deleted]',
                  deletedAt: new Date().toISOString(),
                  isDeleted: true
                };
              }
              return msg;
            });
          }
        });
        return newGroupThreads;
      });

      return response.data;
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  };

  // Thread management
  const openThread = (messageId) => {
    // Thread modal will be opened by the component calling this
    return messageId;
  };

  const joinThreadRoom = (messageId) => {
    if (socketRef.current) {
      socketRef.current.emit('thread:join', { messageId, userId: user?.id });
    }
  };

  const leaveThreadRoom = (messageId) => {
    if (socketRef.current) {
      socketRef.current.emit('thread:leave', { messageId, userId: user?.id });
    }
  };

  const value = useMemo(() => ({
    connected,
    onlineUserIds,
    isOnline,
    threads,
    groupThreads,
    groups,
    openThreadUserId,
    openGroupId,
    minimized,
    setMinimized,
    openChat,
    openGroupChat,
    sendMessage,
    sendGroupMessage,
    markRead,
    typingUsers,
    startTyping,
    stopTyping,
    isUserTyping,
    addReaction,
    editMessage,
    deleteMessage,
    openThread,
    joinThreadRoom,
    leaveThreadRoom,
    socket: socketRef.current,
  }), [connected, onlineUserIds, threads, groupThreads, groups, openThreadUserId, openGroupId, minimized, typingUsers]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
