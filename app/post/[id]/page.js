'use client';

import '@/app/styles/blog.css';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import CommentThread from '@/components/CommentThread';
import FlairBadge from '@/components/FlairBadge';
import useUserRole from '@/lib/useUserRole';
import { getPostById, upvotePost, downvotePost, incrementViewCount, votePoll } from '@/lib/firestore';
import toast from 'react-hot-toast';

const CATEGORY_MAP = {
  housing: { label: 'Nhà trọ', emoji: '🏠', color: '#3b82f6' },
  food: { label: 'Ẩm thực', emoji: '🍜', color: '#ef4444' },
  academic: { label: 'Học tập', emoji: '📚', color: '#8b5cf6' },
  general: { label: 'Tổng hợp', emoji: '💬', color: '#6b7280' },
  social: { label: 'Xã hội', emoji: '🎉', color: '#f59e0b' },
};

function timeAgo(dateInput) {
  if (!dateInput) return '';
  const date = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

function displayName(name) {
  if (!name) return 'Ẩn danh';
  if (name.includes('@')) return name.split('@')[0];
  return name;
}

export default function PostDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    fetchPost();
    incrementViewCount(id).catch(() => {});
  }, [id]);

  const fetchPost = async () => {
    try {
      const data = await getPostById(id);
      if (data) {
        setPost(data);
      } else {
        toast.error('Không tìm thấy bài viết');
        router.push('/blog');
      }
    } catch (error) {
      toast.error('Lỗi tải bài viết');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const { user, isAdmin } = useUserRole();
  const hasUpvoted = post?.upvotedBy?.includes(user?.uid);
  const hasDownvoted = post?.downvotedBy?.includes(user?.uid);
  const score = (post?.upvotes || 0) - (post?.downvotes || 0);
  const cat = CATEGORY_MAP[post?.category] || CATEGORY_MAP.general;

  const handleUpvote = async () => {
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (voting) return;
    setVoting(true);
    try {
      await upvotePost(id, user.uid);
      fetchPost();
    } catch (e) {
      toast.error('Lỗi vote');
    } finally {
      setVoting(false);
    }
  };

  const handleDownvote = async () => {
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (voting) return;
    setVoting(true);
    try {
      await downvotePost(id, user.uid);
      fetchPost();
    } catch (e) {
      toast.error('Lỗi vote');
    } finally {
      setVoting(false);
    }
  };

  const handleVotePoll = async (optionIndex) => {
    if (!user) return toast.error('Vui lòng đăng nhập để bình chọn');
    try {
      await votePoll(id, optionIndex, user.uid);
      setVoted(true);
      fetchPost();
      toast.success('Đã bình chọn!');
    } catch (error) {
      toast.error('Lỗi khi bình chọn');
    }
  };

  if (loading) {
    return (
      <div className="blog-root">
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!post) return null;

  const totalVotes = post.pollData?.options?.reduce((sum, o) => sum + (o.votes || 0), 0) || 0;

  return (
    <ProtectedRoute>
      <div className="blog-root">
        <Navbar />
        <main className="blog-main">
          {/* Back button */}
          <div style={{ marginBottom: '1rem' }}>
            <Link href="/blog" style={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              ← Quay lại Feed
            </Link>
          </div>

          {/* Post card */}
          <div className="pd-card">
            {/* Image */}
            {post.imageUrl && (
              <img src={post.imageUrl} alt={post.title} className="pd-image" />
            )}

            {/* Header with vote + meta + title */}
            <div className="pd-header">
              <div className="pd-vote-col">
                <button
                  onClick={handleUpvote}
                  disabled={voting}
                  className={`tc-vote-btn ${hasUpvoted ? 'tc-voted-up' : ''}`}
                >
                  <svg width="24" height="16" viewBox="0 0 20 14" fill="currentColor"><path d="M10 0L20 14H0L10 0Z"/></svg>
                </button>
                <span className={`tc-score ${score > 0 ? 'tc-positive' : score < 0 ? 'tc-negative' : ''}`} style={{ fontSize: '1.1rem' }}>
                  {score}
                </span>
                <button
                  onClick={handleDownvote}
                  disabled={voting}
                  className={`tc-vote-btn ${hasDownvoted ? 'tc-voted-down' : ''}`}
                >
                  <svg width="24" height="16" viewBox="0 0 20 14" fill="currentColor"><path d="M10 14L0 0H20L10 14Z"/></svg>
                </button>
              </div>

              <div className="pd-content-col">
                <div className="pd-meta">
                  <span className="pd-category" style={{ '--cat-color': cat.color }}>
                    {cat.emoji} {cat.label}
                  </span>
                  {post.flair && <FlairBadge flair={post.flair} />}
                  <span className="pd-dot">•</span>
                  {post.isAnonymous ? (
                    <div className="tc-avatar" style={{ background: '#cbd5e1', color: '#64748b', fontSize: '0.7rem' }}>👤</div>
                  ) : post.authorAvatar ? (
                    <img src={post.authorAvatar} alt={displayName(post.authorName)} className="tc-avatar" />
                  ) : (
                    <div className="tc-avatar">{displayName(post.authorName).charAt(0).toUpperCase()}</div>
                  )}
                  <span className="pd-author">
                    {displayName(post.authorName)}
                    {post.isAnonymous && isAdmin && (
                      <span style={{ color: '#ef4444', fontWeight: 600, marginLeft: '0.25rem' }}>
                        (Bởi: {post.realAuthorName || 'Chưa rõ'})
                      </span>
                    )}
                  </span>
                  <span className="pd-dot">•</span>
                  <span className="pd-time">{timeAgo(post.createdAt)}</span>
                </div>
                <h1 className="pd-title">{post.title}</h1>
              </div>
            </div>

            {/* Body */}
            <div className="pd-body">
              {post.type === 'poll' ? (
                <div style={{ padding: '1rem', background: '#eff6ff', borderRadius: '1rem', border: '1px solid #bfdbfe' }}>
                  <p style={{ fontWeight: 700, color: '#1e40af', marginBottom: '1rem' }}>
                    🗳️ {post.pollData?.question || post.title}
                  </p>
                  {post.pollData?.options?.map((opt, idx) => {
                    const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                    return (
                      <div
                        key={idx}
                        onClick={() => !voted && handleVotePoll(idx)}
                        style={{
                          position: 'relative', height: '3rem', background: '#fff', borderRadius: '0.75rem',
                          overflow: 'hidden', border: '1px solid #bfdbfe', marginBottom: '0.5rem', cursor: voted ? 'default' : 'pointer',
                        }}
                      >
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: 'rgba(59,130,246,0.15)', width: `${percent}%`, transition: 'width 0.5s' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', fontSize: '0.9rem', fontWeight: 500 }}>
                          <span>{opt.text}</span>
                          <span style={{ fontWeight: 700, color: '#2563eb' }}>{percent}%</span>
                        </div>
                      </div>
                    );
                  })}
                  <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#3b82f6', fontStyle: 'italic', marginTop: '0.5rem' }}>
                    {totalVotes > 0 ? `Tổng cộng ${totalVotes} lượt bình chọn` : 'Hãy bình chọn ngay!'}
                  </p>
                </div>
              ) : (
                <div className="pd-text">
                  {post.content?.split(/(#\w+)/g).map((part, i) =>
                    part.startsWith('#') ? (
                      <Link key={i} href={`/blog/tag/${part.substring(1).toLowerCase()}`} style={{ color: '#3b82f6', fontWeight: 600 }}>
                        {part}
                      </Link>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="pd-stats">
              <span>💬 {post.commentCount || 0} bình luận</span>
              <span>👁️ {post.viewCount || 0} lượt xem</span>
              <span>⬆️ {post.upvotes || 0} upvote</span>
            </div>
          </div>

          {/* Comments */}
          <div className="pd-comments">
            <h2 className="pd-comments-header">
              Thảo luận ({post.commentCount || 0})
            </h2>
            <CommentThread
              comments={post.comments || []}
              postId={id}
              onRefresh={fetchPost}
            />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
