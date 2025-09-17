import React, { useState, useRef, useEffect } from 'react';

const COMMON_EMOJIS = [
  '👍', '👎', '❤️', '😂', '😢', '😮', '😡', '👏',
  '🎉', '🤔', '😊', '😔', '💯', '🔥', '⭐', '✅',
  '❌', '⚡', '💪', '🙌', '🤝', '👀', '🎯', '💡'
];

const EMOJI_CATEGORIES = {
  people: {
    name: 'People',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳']
  },
  gestures: {
    name: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✊', '👊', '🤛', '🤜', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👪']
  },
  objects: {
    name: 'Objects',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🔥', '⭐', '🌟', '✨', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💬', '👁️‍🗨️']
  }
};

const EmojiPicker = ({ isOpen, onClose, onEmojiSelect, anchorRef }) => {
  const [selectedCategory, setSelectedCategory] = useState('common');
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleEmojiClick = (emoji) => {
    onEmojiSelect(emoji);
    onClose();
  };

  return (
    <div 
      ref={pickerRef}
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-80 max-h-96 overflow-hidden"
      style={{
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: '8px'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">Add Reaction</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-gray-200 mb-3">
        <button
          onClick={() => setSelectedCategory('common')}
          className={`px-3 py-1 text-xs font-medium rounded-t-lg transition-colors ${
            selectedCategory === 'common'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Common
        </button>
        {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-3 py-1 text-xs font-medium rounded-t-lg transition-colors ${
              selectedCategory === key
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
        {(selectedCategory === 'common' 
          ? COMMON_EMOJIS 
          : EMOJI_CATEGORIES[selectedCategory]?.emojis || []
        ).map((emoji, index) => (
          <button
            key={index}
            onClick={() => handleEmojiClick(emoji)}
            className="p-2 text-lg hover:bg-gray-100 rounded transition-colors flex items-center justify-center"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Search (could be added later) */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Click an emoji to add it as a reaction
        </p>
      </div>
    </div>
  );
};

export default EmojiPicker;