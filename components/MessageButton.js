'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDirectMessageConnection } from '@/lib/firestore';
import toast from 'react-hot-toast';

export default function MessageButton({ currentUser, targetUserId, targetUserName = 'Người dùng', size = 'md' }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleMessage = async () => {
    if (!currentUser) {
      toast.error('Vui lòng đăng nhập để gửi tin nhắn');
      return;
    }

    if (currentUser.uid === targetUserId) {
      toast.error('Bạn không thể nhắn tin cho chính mình');
      return;
    }

    setLoading(true);
    try {
      const { connectionId } = await createDirectMessageConnection(currentUser, targetUserId, targetUserName);
      toast.success('Đang kết nối trò chuyện...');
      router.push(`/messages/${connectionId}`);
    } catch (error) {
      console.error('Lỗi khi tạo kết nối chat:', error);
      toast.error(error.message || 'Không thể tạo cuộc trò chuyện');
    } finally {
      setLoading(false);
    }
  };

  const sizes = {
    sm: { padding: '0.3rem 0.75rem', fontSize: '0.75rem' },
    md: { padding: '0.45rem 1.2rem', fontSize: '0.85rem' },
    lg: { padding: '0.55rem 1.5rem', fontSize: '0.95rem' },
  };

  const sizeStyle = sizes[size] || sizes.md;

  return (
    <button
      onClick={handleMessage}
      disabled={loading}
      style={{
        padding: sizeStyle.padding,
        fontSize: sizeStyle.fontSize,
        fontWeight: 700,
        borderRadius: '2rem',
        border: '1.5px solid transparent',
        background: 'linear-gradient(135deg, #14b8a6, #06b6d4)',
        color: '#fff',
        cursor: loading ? 'wait' : 'pointer',
        transition: 'all 0.25s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(20,184,166,0.25)',
        opacity: loading ? 0.7 : 1,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(20,184,166,0.35)';
        }
      }}
      onMouseLeave={(e) => {
        if (!loading) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(20,184,166,0.25)';
        }
      }}
    >
      {loading ? (
        <>
          <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-1"></span>
          Đang kết nối...
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            style={{ width: '1.1em', height: '1.1em', marginTop: '-1px' }}
          >
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
          Nhắn tin
        </>
      )}
    </button>
  );
}
