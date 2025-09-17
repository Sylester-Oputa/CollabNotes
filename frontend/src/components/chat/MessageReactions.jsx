import React, { useState } from 'react';

const MessageReactions = ({ messageId, reactions, onAddReaction, currentUserId }) => {
  const [showTooltip, setShowTooltip] = useState(null);

  if (!reactions || reactions.length === 0) {
    return null;
  }

  const handleReactionClick = (emoji) => {
    onAddReaction(messageId, emoji);
  };

  const handleMouseEnter = (emoji, users) => {
    if (users.length > 0) {
      setShowTooltip({ emoji, users });
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(null);
  };

  return (
    <div className="flex flex-wrap gap-1 mt-2 relative">
      {reactions.map((reaction) => {
        const hasReacted = reaction.users.some(user => user.id === currentUserId);
        
        return (
          <div
            key={reaction.emoji}
            className="relative"
            onMouseEnter={() => handleMouseEnter(reaction.emoji, reaction.users)}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => handleReactionClick(reaction.emoji)}
              className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border transition-all ${
                hasReacted
                  ? 'bg-blue-100 border-blue-200 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
              }`}
              title={`${reaction.users.map(u => u.name).join(', ')} reacted with ${reaction.emoji}`}
            >
              <span className="text-sm">{reaction.emoji}</span>
              <span className="text-xs">{reaction.count}</span>
            </button>

            {/* Tooltip */}
            {showTooltip && showTooltip.emoji === reaction.emoji && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap z-50">
                <div className="max-w-xs">
                  {showTooltip.users.length === 1 ? (
                    <span>{showTooltip.users[0].name} reacted with {reaction.emoji}</span>
                  ) : showTooltip.users.length <= 3 ? (
                    <span>
                      {showTooltip.users.map(u => u.name).join(', ')} reacted with {reaction.emoji}
                    </span>
                  ) : (
                    <span>
                      {showTooltip.users.slice(0, 2).map(u => u.name).join(', ')} and {showTooltip.users.length - 2} others reacted with {reaction.emoji}
                    </span>
                  )}
                </div>
                {/* Tooltip arrow */}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MessageReactions;