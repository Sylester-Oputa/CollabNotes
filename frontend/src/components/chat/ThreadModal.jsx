import React, { useState, useEffect, useRef } from 'react';
import { threads } from '../../utils/api';
import { useChat } from '../../context/ChatContext';
import MessageReactions from './MessageReactions';
import EmojiPicker from './EmojiPicker';
import MessageEditModal from './MessageEditModal';
import './ThreadModal.css';

const ThreadModal = ({ messageId, isOpen, onClose }) => {
  const [threadData, setThreadData] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  
  const { user, socket, addReaction, editMessage, deleteMessage } = useChat();
  const repliesEndRef = useRef(null);
  const replyInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && messageId) {
      loadThread();
      joinThreadRoom();
    }
    return () => {
      if (socket && messageId) {
        socket.emit('thread:leave', { messageId, userId: user?.id });
      }
    };
  }, [isOpen, messageId]);

  useEffect(() => {
    if (socket) {
      socket.on('newReply', handleNewReply);
      socket.on('threadActivity', handleThreadActivity);
      socket.on('messageReactionAdded', handleReactionUpdate);
      socket.on('messageReactionRemoved', handleReactionUpdate);
      socket.on('messageUpdated', handleMessageUpdate);

      return () => {
        socket.off('newReply', handleNewReply);
        socket.off('threadActivity', handleThreadActivity);
        socket.off('messageReactionAdded', handleReactionUpdate);
        socket.off('messageReactionRemoved', handleReactionUpdate);
        socket.off('messageUpdated', handleMessageUpdate);
      };
    }
  }, [socket]);

  const loadThread = async () => {
    try {
      setLoading(true);
      const response = await threads.getThread(messageId, page);
      setThreadData(response.data.parentMessage);
      setReplies(page === 1 ? response.data.replies : [...replies, ...response.data.replies]);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error loading thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinThreadRoom = async () => {
    try {
      await threads.joinThread(messageId);
      if (socket) {
        socket.emit('thread:join', { messageId, userId: user?.id });
      }
    } catch (error) {
      console.error('Error joining thread room:', error);
    }
  };

  const handleNewReply = ({ reply, parentMessageId }) => {
    if (parentMessageId === messageId) {
      setReplies(prev => [...prev, reply]);
      scrollToBottom();
    }
  };

  const handleThreadActivity = ({ type, messageId: activityMessageId, replyCount }) => {
    if (activityMessageId === messageId && type === 'new_reply') {
      // Update reply count if needed
    }
  };

  const handleReactionUpdate = ({ messageId: reactionMessageId, reactions }) => {
    if (reactionMessageId === messageId) {
      setThreadData(prev => prev ? { ...prev, reactions } : null);
    } else {
      setReplies(prev => prev.map(reply => 
        reply.id === reactionMessageId ? { ...reply, reactions } : reply
      ));
    }
  };

  const handleMessageUpdate = ({ messageId: updatedMessageId, content, editedAt }) => {
    if (updatedMessageId === messageId) {
      setThreadData(prev => prev ? { ...prev, content, editedAt } : null);
    } else {
      setReplies(prev => prev.map(reply => 
        reply.id === updatedMessageId ? { ...reply, content, editedAt } : reply
      ));
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim() || submitting) return;

    try {
      setSubmitting(true);
      await threads.createReply(messageId, replyContent.trim());
      setReplyContent('');
      replyInputRef.current?.focus();
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmojiSelect = async (emoji, targetMessageId) => {
    try {
      await addReaction(targetMessageId, emoji);
      setShowEmojiPicker(null);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    try {
      await editMessage(messageId, newContent);
      setEditingMessage(null);
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const loadMoreReplies = () => {
    if (pagination?.hasNext && !loading) {
      setPage(prev => prev + 1);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const canEditMessage = (message) => {
    if (!user || message.sender.id !== user.id) return false;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return new Date(message.createdAt) > twentyFourHoursAgo && !message.deletedAt;
  };

  if (!isOpen) return null;

  return (
    <div className="thread-modal-overlay" onClick={onClose}>
      <div className="thread-modal" onClick={e => e.stopPropagation()}>
        <div className="thread-modal-header">
          <h3>Thread</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="thread-modal-content">
          {loading && !threadData ? (
            <div className="thread-loading">Loading thread...</div>
          ) : (
            <>
              {/* Parent Message */}
              {threadData && (
                <div className="thread-parent-message">
                  <div className="message-header">
                    <span className="message-sender">{threadData.sender.name}</span>
                    <span className="message-time">{formatTimestamp(threadData.createdAt)}</span>
                    {threadData.editedAt && (
                      <span className="message-edited">(edited)</span>
                    )}
                  </div>
                  <div className="message-content">{threadData.content}</div>
                  
                  {/* Attachments */}
                  {threadData.attachments?.length > 0 && (
                    <div className="message-attachments">
                      {threadData.attachments.map(attachment => (
                        <div key={attachment.id} className="attachment">
                          <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer">
                            {attachment.fileName}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reactions */}
                  <MessageReactions
                    reactions={threadData.reactions}
                    onReactionClick={(emoji) => handleEmojiSelect(emoji, threadData.id)}
                    onShowPicker={() => setShowEmojiPicker(threadData.id)}
                  />

                  {/* Message Actions */}
                  <div className="message-actions">
                    <button 
                      className="action-button emoji-button"
                      onClick={() => setShowEmojiPicker(showEmojiPicker === threadData.id ? null : threadData.id)}
                      title="Add reaction"
                    >
                      😊
                    </button>
                    {canEditMessage(threadData) && (
                      <button 
                        className="action-button"
                        onClick={() => setEditingMessage(threadData)}
                        title="Edit message"
                      >
                        ✏️
                      </button>
                    )}
                  </div>

                  {showEmojiPicker === threadData.id && (
                    <EmojiPicker
                      onEmojiSelect={(emoji) => handleEmojiSelect(emoji, threadData.id)}
                      onClose={() => setShowEmojiPicker(null)}
                    />
                  )}
                </div>
              )}

              {/* Replies */}
              <div className="thread-replies">
                {pagination?.hasPrev && (
                  <button className="load-more-button" onClick={loadMoreReplies} disabled={loading}>
                    {loading ? 'Loading...' : 'Load older replies'}
                  </button>
                )}

                {replies.map(reply => (
                  <div key={reply.id} className="thread-reply">
                    <div className="message-header">
                      <span className="message-sender">{reply.sender.name}</span>
                      <span className="message-time">{formatTimestamp(reply.createdAt)}</span>
                      {reply.editedAt && (
                        <span className="message-edited">(edited)</span>
                      )}
                    </div>
                    <div className="message-content">{reply.content}</div>
                    
                    {/* Attachments */}
                    {reply.attachments?.length > 0 && (
                      <div className="message-attachments">
                        {reply.attachments.map(attachment => (
                          <div key={attachment.id} className="attachment">
                            <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer">
                              {attachment.fileName}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reactions */}
                    <MessageReactions
                      reactions={reply.reactions}
                      onReactionClick={(emoji) => handleEmojiSelect(emoji, reply.id)}
                      onShowPicker={() => setShowEmojiPicker(reply.id)}
                    />

                    {/* Message Actions */}
                    <div className="message-actions">
                      <button 
                        className="action-button emoji-button"
                        onClick={() => setShowEmojiPicker(showEmojiPicker === reply.id ? null : reply.id)}
                        title="Add reaction"
                      >
                        😊
                      </button>
                      {canEditMessage(reply) && (
                        <button 
                          className="action-button"
                          onClick={() => setEditingMessage(reply)}
                          title="Edit message"
                        >
                          ✏️
                        </button>
                      )}
                    </div>

                    {showEmojiPicker === reply.id && (
                      <EmojiPicker
                        onEmojiSelect={(emoji) => handleEmojiSelect(emoji, reply.id)}
                        onClose={() => setShowEmojiPicker(null)}
                      />
                    )}
                  </div>
                ))}
                <div ref={repliesEndRef} />
              </div>

              {/* Reply Input */}
              <form className="thread-reply-form" onSubmit={handleSendReply}>
                <div className="reply-input-container">
                  <textarea
                    ref={replyInputRef}
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Reply to thread..."
                    className="reply-input"
                    rows="3"
                    disabled={submitting}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply(e);
                      }
                    }}
                  />
                  <button 
                    type="submit" 
                    className="reply-submit-button"
                    disabled={!replyContent.trim() || submitting}
                  >
                    {submitting ? 'Sending...' : 'Reply'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Edit Modal */}
        {editingMessage && (
          <MessageEditModal
            message={editingMessage}
            onEdit={handleEditMessage}
            onClose={() => setEditingMessage(null)}
          />
        )}
      </div>
    </div>
  );
};

export default ThreadModal;