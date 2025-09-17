import React, { useState, useEffect } from 'react';
import { threads } from '../../utils/api';
import './ThreadIndicator.css';

const ThreadIndicator = ({ messageId, onOpenThread }) => {
  const [threadSummary, setThreadSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadThreadSummary();
  }, [messageId]);

  const loadThreadSummary = async () => {
    try {
      setLoading(true);
      const response = await threads.getThreadSummary(messageId);
      if (response.data.replyCount > 0) {
        setThreadSummary(response.data);
      }
    } catch (error) {
      console.error('Error loading thread summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !threadSummary || threadSummary.replyCount === 0) {
    return null;
  }

  const formatReplyCount = (count) => {
    if (count === 1) return '1 reply';
    return `${count} replies`;
  };

  const formatLastReplyTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="thread-indicator" onClick={() => onOpenThread(messageId)}>
      <div className="thread-indicator-content">
        <div className="thread-icon">💬</div>
        <div className="thread-info">
          <div className="thread-count">{formatReplyCount(threadSummary.replyCount)}</div>
          {threadSummary.latestReplies.length > 0 && (
            <div className="thread-preview">
              <span className="last-reply-author">
                {threadSummary.latestReplies[threadSummary.latestReplies.length - 1].sender.name}
              </span>
              <span className="last-reply-time">
                {formatLastReplyTime(threadSummary.latestReplies[threadSummary.latestReplies.length - 1].createdAt)}
              </span>
            </div>
          )}
        </div>
        <div className="thread-avatars">
          {threadSummary.latestReplies.slice(-3).map((reply, index) => (
            <div key={reply.id} className="thread-avatar" style={{ zIndex: 3 - index }}>
              {reply.sender.name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      </div>
      <div className="thread-indicator-arrow">→</div>
    </div>
  );
};

export default ThreadIndicator;