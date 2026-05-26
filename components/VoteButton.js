'use client';

import { useState } from 'react';

export default function VoteButton({
  type,
  count,
  userVote,
  onVote,
  size = 'md',
  disabled = false
}) {
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async () => {
    if (disabled || isVoting) return;
    setIsVoting(true);
    try {
      await onVote();
    } finally {
      setIsVoting(false);
    }
  };

  const sizes = {
    sm: 'text-sm gap-1 px-2 py-1',
    md: 'text-base gap-1.5 px-3 py-1.5',
    lg: 'text-lg gap-2 px-4 py-2',
  };

  const countSizes = {
    sm: 'text-xs',
    md: 'text-sm font-semibold',
    lg: 'text-base font-bold',
  };

  return (
    <div className={`flex items-center ${type === 'vertical' ? 'flex-col' : ''}`}>
      <button
        onClick={handleVote}
        disabled={disabled || isVoting}
        className={`flex items-center ${sizes[size]} rounded-full transition-colors ${
          userVote === 'up'
            ? 'bg-orange-100 text-orange-600'
            : 'bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-orange-500'
        } disabled:opacity-50`}
        title={userVote === 'up' ? 'Bỏ upvote' : 'Upvote'}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2l1.45 4.45L16 6l-4.55 2.9L14.1 12 16 17l-6-6-6 6 1.9-4.1L4 6l4.55-1.55L4 2l6 3.5L4 2z" transform="rotate(180 10 10)" />
        </svg>
        <span className={countSizes[size]}>{count || 0}</span>
      </button>

      <button
        onClick={handleVote}
        disabled={disabled || isVoting}
        className={`flex items-center ${sizes[size]} rounded-full transition-colors ${
          userVote === 'down'
            ? 'bg-blue-100 text-blue-600'
            : 'bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-500'
        } disabled:opacity-50`}
        title={userVote === 'down' ? 'Bỏ downvote' : 'Downvote'}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2l1.45 4.45L16 6l-4.55 2.9L14.1 12 16 17l-6-6-6 6 1.9-4.1L4 6l4.55-1.55L4 2l6 3.5L4 2z" />
        </svg>
      </button>
    </div>
  );
}
