'use client';

import { useState, useRef, useEffect } from 'react';
import '@/app/styles/reaction.css';

const REACTIONS = [
  { type: 'heart', emoji: '❤️', label: 'Thích' },
  { type: 'fire', emoji: '🔥', label: 'Hot' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Buồn' },
  { type: 'angry', emoji: '😡', label: 'Giận' },
];

/**
 * ReactionButton — Facebook-style reaction picker
 * Props:
 *   - reactions: { heart: ['uid1'], fire: ['uid2'], ... }
 *   - userId: current user ID
 *   - onReact: (reactionType) => Promise
 *   - disabled: boolean
 */
export default function ReactionButton({ reactions = {}, userId, onReact, disabled = false }) {
  const [showPicker, setShowPicker] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const [animatingEmoji, setAnimatingEmoji] = useState(null);
  const pickerRef = useRef(null);
  const timeoutRef = useRef(null);

  // Find user's current reaction
  const userReaction = REACTIONS.find(r => reactions[r.type]?.includes(userId));

  // Total reaction count
  const totalCount = Object.values(reactions).reduce((sum, arr) => sum + (arr?.length || 0), 0);

  // Top 3 reaction types by count
  const topReactions = REACTIONS
    .filter(r => reactions[r.type]?.length > 0)
    .sort((a, b) => (reactions[b.type]?.length || 0) - (reactions[a.type]?.length || 0))
    .slice(0, 3);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  const handleReact = async (reactionType) => {
    if (disabled || isReacting) return;
    setIsReacting(true);
    setAnimatingEmoji(reactionType);
    setShowPicker(false);
    
    try {
      await onReact(reactionType);
    } finally {
      setTimeout(() => {
        setIsReacting(false);
        setAnimatingEmoji(null);
      }, 300);
    }
  };

  // Default click = toggle heart (or remove current reaction)
  const handleDefaultClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (userReaction) {
      handleReact(userReaction.type); // Remove current
    } else {
      handleReact('heart'); // Default to heart
    }
  };

  // Long press / hover to show picker
  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setShowPicker(true), 500);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return (
    <div className="reaction-container" ref={pickerRef}>
      {/* Main button */}
      <button
        className={`reaction-main-btn ${userReaction ? 'reacted' : ''} ${animatingEmoji ? 'reaction-animate' : ''}`}
        onClick={handleDefaultClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={disabled || isReacting}
        title={userReaction ? `Bạn đã ${userReaction.label}` : 'Thích'}
        data-reaction={userReaction?.type || ''}
      >
        {userReaction ? (
          <span className="reaction-main-emoji">{userReaction.emoji}</span>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        )}
      </button>

      {/* Reaction summary */}
      {totalCount > 0 && (
        <span className="reaction-summary">
          {topReactions.map(r => (
            <span key={r.type} className="reaction-summary-emoji" title={`${reactions[r.type]?.length || 0} ${r.label}`}>
              {r.emoji}
            </span>
          ))}
          <span className="reaction-summary-count">{totalCount}</span>
        </span>
      )}

      {/* Reaction Picker */}
      {showPicker && (
        <div className="reaction-picker" onMouseLeave={() => setShowPicker(false)}>
          {REACTIONS.map((r, idx) => (
            <button
              key={r.type}
              className={`reaction-picker-item ${userReaction?.type === r.type ? 'reaction-picker-active' : ''}`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleReact(r.type); }}
              title={r.label}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <span className="reaction-picker-emoji">{r.emoji}</span>
              <span className="reaction-picker-label">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
