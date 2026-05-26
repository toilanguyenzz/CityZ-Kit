'use client';

import { useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { upvotePost, downvotePost } from '@/lib/firestore';
import FlairBadge from './FlairBadge';
import toast from 'react-hot-toast';

function timeAgo(dateInput) {
  if (!dateInput) return '';
  const date = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return date.toLocaleDateString('vi-VN');
}

function displayName(name) {
  if (!name) return 'Ẩn danh';
  if (name.includes('@')) return name.split('@')[0];
  return name;
}

const CATEGORY_MAP = {
  housing: { label: 'Nhà trọ', emoji: '🏠', color: '#3b82f6' },
  food: { label: 'Ẩm thực', emoji: '🍜', color: '#ef4444' },
  academic: { label: 'Học tập', emoji: '📚', color: '#8b5cf6' },
  general: { label: 'Tổng hợp', emoji: '💬', color: '#6b7280' },
  social: { label: 'Xã hội', emoji: '🎉', color: '#f59e0b' },
};

export default function ThreadCard({ post, onVoteUpdate }) {
  const [voting, setVoting] = useState(false);
  const user = auth.currentUser;

  const hasUpvoted = post.upvotedBy?.includes(user?.uid);
  const hasDownvoted = post.downvotedBy?.includes(user?.uid);
  const score = (post.upvotes || 0) - (post.downvotes || 0);
  const cat = CATEGORY_MAP[post.category] || CATEGORY_MAP.general;

  const handleUpvote = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (voting) return;
    setVoting(true);
    try {
      await upvotePost(post.id, user.uid);
      if (onVoteUpdate) onVoteUpdate();
    } catch (err) {
      toast.error('Lỗi vote');
    } finally {
      setVoting(false);
    }
  };

  const handleDownvote = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (voting) return;
    setVoting(true);
    try {
      await downvotePost(post.id, user.uid);
      if (onVoteUpdate) onVoteUpdate();
    } catch (err) {
      toast.error('Lỗi vote');
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className={`tc-card ${post.isPinned ? 'tc-pinned' : ''}`}>
      {/* Vote sidebar */}
      <div className="tc-vote-sidebar">
        <button
          onClick={handleUpvote}
          disabled={voting}
          className={`tc-vote-btn ${hasUpvoted ? 'tc-voted-up' : ''}`}
        >
          <svg width="20" height="14" viewBox="0 0 20 14" fill="currentColor"><path d="M10 0L20 14H0L10 0Z"/></svg>
        </button>
        <span className={`tc-score ${score > 0 ? 'tc-positive' : score < 0 ? 'tc-negative' : ''}`}>
          {score}
        </span>
        <button
          onClick={handleDownvote}
          disabled={voting}
          className={`tc-vote-btn ${hasDownvoted ? 'tc-voted-down' : ''}`}
        >
          <svg width="20" height="14" viewBox="0 0 20 14" fill="currentColor"><path d="M10 14L0 0H20L10 14Z"/></svg>
        </button>
      </div>

      {/* Card body */}
      <Link href={`/post/${post.id}`} className="tc-body">
        {/* Meta line */}
        <div className="tc-meta">
          {post.isPinned && <span className="tc-pin-badge">📌 Ghim</span>}
          <span className="tc-category" style={{ '--cat-color': cat.color }}>
            {cat.emoji} {cat.label}
          </span>
          {post.flair && <FlairBadge flair={post.flair} />}
          <span className="tc-dot">•</span>
          <span className="tc-author">{displayName(post.authorName)}</span>
          <span className="tc-dot">•</span>
          <span className="tc-time">{timeAgo(post.createdAt)}</span>
        </div>

        {/* Title */}
        <h3 className="tc-title">{post.title}</h3>

        {/* Content preview */}
        {post.type !== 'poll' && post.content && (
          <p className="tc-preview">{post.content.substring(0, 200)}{post.content.length > 200 ? '...' : ''}</p>
        )}

        {/* Poll preview */}
        {post.type === 'poll' && post.pollData?.options && (
          <div className="tc-poll-preview">
            <span className="tc-poll-icon">🗳️</span>
            <span>{post.pollData.options.length} lựa chọn</span>
          </div>
        )}

        {/* Image thumbnail */}
        {post.imageUrl && (
          <div className="tc-image-wrap">
            <img src={post.imageUrl} alt={post.title} className="tc-image" />
          </div>
        )}

        {/* Footer stats — hide zeros */}
        <div className="tc-footer">
          {(post.commentCount || 0) > 0 && (
            <span className="tc-stat">💬 {post.commentCount} bình luận</span>
          )}
          {(post.viewCount || 0) > 0 && (
            <span className="tc-stat">👁️ {post.viewCount} lượt xem</span>
          )}
          {!(post.commentCount || 0) && !(post.viewCount || 0) && (
            <span className="tc-stat tc-stat-new">✨ Mới đăng</span>
          )}
        </div>
      </Link>
    </div>
  );
}
