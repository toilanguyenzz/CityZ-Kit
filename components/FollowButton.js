'use client';

import { useState, useEffect } from 'react';
import { followUser, isFollowing } from '@/lib/follow';
import toast from 'react-hot-toast';

export default function FollowButton({ currentUser, targetUserId, currentUserName = '', currentUserAvatar = null, size = 'md' }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!currentUser || !targetUserId || currentUser.uid === targetUserId) {
      setLoading(false);
      return;
    }
    isFollowing(currentUser.uid, targetUserId)
      .then(result => {
        setFollowing(result);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentUser, targetUserId]);

  const handleToggle = async () => {
    if (!currentUser) return toast.error('Vui lòng đăng nhập');
    if (toggling) return;
    
    setToggling(true);
    try {
      const result = await followUser(currentUser.uid, targetUserId, currentUserName, currentUserAvatar);
      setFollowing(result);
      toast.success(result ? 'Đã theo dõi!' : 'Đã bỏ theo dõi');
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setToggling(false);
    }
  };

  // Don't show follow button for own profile
  if (!currentUser || currentUser.uid === targetUserId) return null;
  if (loading) return null;

  const sizes = {
    sm: { padding: '0.3rem 0.75rem', fontSize: '0.75rem' },
    md: { padding: '0.45rem 1.2rem', fontSize: '0.85rem' },
    lg: { padding: '0.55rem 1.5rem', fontSize: '0.95rem' },
  };

  const sizeStyle = sizes[size] || sizes.md;

  return (
    <button
      onClick={handleToggle}
      disabled={toggling}
      className="follow-btn"
      style={{
        padding: sizeStyle.padding,
        fontSize: sizeStyle.fontSize,
        fontWeight: 700,
        borderRadius: '2rem',
        border: following ? '1.5px solid #d1d5db' : '1.5px solid transparent',
        background: following
          ? 'rgba(255,255,255,0.9)'
          : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        color: following ? '#374151' : '#fff',
        cursor: toggling ? 'wait' : 'pointer',
        transition: 'all 0.25s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        backdropFilter: 'blur(8px)',
        boxShadow: following ? 'none' : '0 2px 8px rgba(59,130,246,0.25)',
        opacity: toggling ? 0.7 : 1,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (following) {
          e.target.style.borderColor = '#ef4444';
          e.target.style.color = '#ef4444';
          e.target.textContent = '✕ Bỏ theo dõi';
        }
      }}
      onMouseLeave={(e) => {
        if (following) {
          e.target.style.borderColor = '#d1d5db';
          e.target.style.color = '#374151';
          e.target.textContent = '✓ Đang theo dõi';
        }
      }}
    >
      {following ? '✓ Đang theo dõi' : '+ Theo dõi'}
    </button>
  );
}
