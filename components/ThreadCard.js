'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { likePost, bookmarkPost, sharePost } from '@/lib/firestore';
import useUserRole from '@/lib/useUserRole';
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
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return date.toLocaleDateString('vi-VN');
}

function displayName(name) {
  if (!name) return 'Ẩn danh';
  if (name.includes('@')) return name.split('@')[0];
  return name;
}

function formatCount(num) {
  if (!num || num === 0) return '';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + 'K';
  return num.toString();
}

const CATEGORY_MAP = {
  housing: { label: 'Nhà trọ', emoji: '🏠', color: '#3b82f6' },
  food: { label: 'Ẩm thực', emoji: '🍜', color: '#ef4444' },
  academic: { label: 'Học tập', emoji: '📚', color: '#8b5cf6' },
  general: { label: 'Tổng hợp', emoji: '💬', color: '#6b7280' },
  social: { label: 'Xã hội', emoji: '🎉', color: '#f59e0b' },
};

export default function ThreadCard({ post, onVoteUpdate }) {
  const [liking, setLiking] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [doubleTap, setDoubleTap] = useState(false);
  const lastTapRef = useRef(0);
  const shareRef = useRef(null);

  const { user, isAdmin } = useUserRole();

  // Close share dropdown when clicking outside
  useEffect(() => {
    if (!showShare) return;
    const handleClick = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) {
        setShowShare(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showShare]);

  const hasLiked = post.likedBy?.includes(user?.uid) || post.upvotedBy?.includes(user?.uid);
  const hasBookmarked = post.bookmarkedBy?.includes(user?.uid);
  const likeCount = post.likes || post.upvotes || 0;
  const commentCount = post.commentCount || 0;
  const shareCount = post.shares || 0;
  const cat = CATEGORY_MAP[post.category] || CATEGORY_MAP.general;

  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (liking) return;
    setLiking(true);
    try {
      await likePost(post.id, user.uid);
      if (onVoteUpdate) onVoteUpdate();
    } catch (err) {
      toast.error('Lỗi');
    } finally {
      setLiking(false);
    }
  };

  const handleBookmark = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (bookmarking) return;
    setBookmarking(true);
    try {
      const result = await bookmarkPost(post.id, user.uid);
      toast.success(result ? 'Đã lưu bài viết' : 'Đã bỏ lưu');
      if (onVoteUpdate) onVoteUpdate();
    } catch (err) {
      toast.error('Lỗi');
    } finally {
      setBookmarking(false);
    }
  };

  const handleCopyLink = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
      toast.success('Đã sao chép liên kết');
      setShowShare(false);
      sharePost(post.id).catch(() => {});
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  const handleNativeShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.share({
        title: post.title,
        text: post.content?.substring(0, 100),
        url: `${window.location.origin}/post/${post.id}`,
      });
      setShowShare(false);
      sharePost(post.id).catch(() => {});
    } catch {
      // User cancelled or not supported
    }
  };

  // Double-tap to like (Instagram style)
  const handleDoubleTap = (e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      e.stopPropagation();
      if (!hasLiked && user) {
        setDoubleTap(true);
        handleLike(e);
        setTimeout(() => setDoubleTap(false), 800);
      }
    }
    lastTapRef.current = now;
  };

  return (
    <div className={`tc-card ${post.isPinned ? 'tc-pinned' : ''}`}>
      <div className="tc-card-inner">
        {/* Avatar */}
        {post.isAnonymous ? (
          <div className="tc-avatar" style={{ background: '#536471' }}>👤</div>
        ) : post.authorAvatar ? (
          <div className="tc-avatar">
            <img src={post.authorAvatar} alt={displayName(post.authorName)} />
          </div>
        ) : (
          <div className="tc-avatar">{displayName(post.authorName).charAt(0).toUpperCase()}</div>
        )}

        {/* Content Column */}
        <div className="tc-content">
          {/* Header: Name · Handle · Time */}
          <div className="tc-header">
            <span className="tc-display-name">
              {displayName(post.authorName)}
              {!post.isAnonymous && post.authorBadges && post.authorBadges.map((badge, idx) => (
                <span key={idx} title={badge.name} style={{ marginLeft: '0.2rem', fontSize: '0.85rem', cursor: 'help' }}>
                  {badge.icon}
                </span>
              ))}
            </span>
            {post.isAnonymous && isAdmin && (
              <span style={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 600 }}>
                ({post.realAuthorName || '?'})
              </span>
            )}
            <span className="tc-dot">•</span>
            <span className="tc-time">{timeAgo(post.createdAt)}</span>
            {post.isPinned && <span className="tc-pin-badge">📌 Ghim</span>}
          </div>

          {/* Category + Flair */}
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="tc-category">{cat.emoji} {cat.label}</span>
            {post.flair && <FlairBadge flair={post.flair} />}
          </div>

          {/* Title */}
          <Link href={`/post/${post.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <h3 className="tc-title">{post.title}</h3>
          </Link>

          {/* Content preview */}
          <Link href={`/post/${post.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            {post.type !== 'poll' && post.content && (
              <p className="tc-preview">{post.content.substring(0, 280)}{post.content.length > 280 ? '...' : ''}</p>
            )}
          </Link>

          {/* Poll preview */}
          {post.type === 'poll' && post.pollData?.options && (
            <Link href={`/post/${post.id}`} style={{ textDecoration: 'none' }}>
              <div className="tc-poll-preview">
                <span className="tc-poll-icon">🗳️</span>
                <span>{post.pollData.options.length} lựa chọn · Bình chọn ngay</span>
              </div>
            </Link>
          )}

          {/* Media Gallery */}
          <Link href={`/post/${post.id}`} style={{ textDecoration: 'none', color: 'inherit', position: 'relative' }}>
            <div onTouchEnd={handleDoubleTap} style={{ position: 'relative' }}>
              {post.media && post.media.length > 0 ? (
                <div className={`tc-media-grid tc-media-count-${Math.min(post.media.length, 4)}`}>
                  {post.media.slice(0, 4).map((item, idx) => {
                    const isMore = post.media.length > 4 && idx === 3;
                    return (
                      <div key={idx} className="tc-media-item">
                        {item.type === 'video' ? (
                          <div className="tc-media-video-wrapper">
                            <video src={item.url} className="tc-media-video" muted playsInline />
                            <div className="tc-media-video-badge">▶ Video</div>
                          </div>
                        ) : (
                          <img src={item.url} alt={post.title} className="tc-media-img" />
                        )}
                        {isMore && (
                          <div className="tc-media-more-overlay">
                            <span>+{post.media.length - 3}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : post.imageUrl ? (
                <div className="tc-image-wrap">
                  <img src={post.imageUrl} alt={post.title} className="tc-image" />
                </div>
              ) : null}

              {/* Double-tap heart overlay */}
              <span className={`tc-double-tap-heart ${doubleTap ? 'active' : ''}`}>❤️</span>
            </div>
          </Link>

          {/* ── Action Bar (Twitter/Threads style) ── */}
          <div className="tc-action-bar">
            {/* Comment */}
            <div className="tc-action-group comment">
              <Link href={`/post/${post.id}`} className="tc-action-btn" title="Bình luận" onClick={(e) => e.stopPropagation()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </Link>
              {commentCount > 0 && <span className="tc-action-count">{formatCount(commentCount)}</span>}
            </div>

            {/* Like */}
            <div className={`tc-action-group like ${hasLiked ? 'liked' : ''}`}>
              <button onClick={handleLike} disabled={liking} className="tc-action-btn" title={hasLiked ? 'Bỏ thích' : 'Thích'}>
                {hasLiked ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                )}
              </button>
              {likeCount > 0 && <span className="tc-action-count">{formatCount(likeCount)}</span>}
            </div>

            {/* Share */}
            <div className="tc-action-group share" ref={shareRef}>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowShare(!showShare); }}
                className="tc-action-btn"
                title="Chia sẻ"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                  <polyline points="16,6 12,2 8,6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </button>
              {shareCount > 0 && <span className="tc-action-count">{formatCount(shareCount)}</span>}

              {/* Share dropdown */}
              {showShare && (
                <div className="tc-share-dropdown">
                  <button className="tc-share-option" onClick={handleCopyLink}>
                    <span className="tc-share-option-icon">🔗</span>
                    <span>Sao chép liên kết</span>
                  </button>
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button className="tc-share-option" onClick={handleNativeShare}>
                      <span className="tc-share-option-icon">📤</span>
                      <span>Chia sẻ qua...</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bookmark */}
            <div className={`tc-action-group bookmark ${hasBookmarked ? 'bookmarked' : ''}`}>
              <button onClick={handleBookmark} disabled={bookmarking} className="tc-action-btn" title={hasBookmarked ? 'Bỏ lưu' : 'Lưu bài'}>
                {hasBookmarked ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
