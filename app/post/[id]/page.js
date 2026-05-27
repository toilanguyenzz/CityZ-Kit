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
import { getPostById, upvotePost, downvotePost, incrementViewCount, votePoll, updatePost, deletePost } from '@/lib/firestore';
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
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // Lightbox Zoom & Pan State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxScale, setLightboxScale] = useState(1);
  const [lightboxPosition, setLightboxPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Edit & Delete states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('general');
  const [editFlair, setEditFlair] = useState('');
  const [editIsAnonymous, setEditIsAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    if (!post) return;
    setEditTitle(post.title || '');
    setEditContent(post.content || '');
    setEditCategory(post.category || 'general');
    setEditFlair(post.flair || '');
    setEditIsAnonymous(post.isAnonymous || false);
    setIsEditing(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return toast.error('Vui lòng nhập tiêu đề');
    if (post.type !== 'poll' && !editContent.trim()) return toast.error('Vui lòng nhập nội dung');

    setSaving(true);
    try {
      const updatedData = {
        title: editTitle.trim(),
        category: editCategory,
        flair: editFlair || null,
        isAnonymous: editIsAnonymous,
      };

      if (post.type !== 'poll') {
        updatedData.content = editContent.trim();
      }

      await updatePost(id, updatedData);
      toast.success('Đã cập nhật bài viết thành công!');
      setIsEditing(false);
      await fetchPost();
    } catch (err) {
      toast.error('Lỗi khi cập nhật bài viết: ' + err.message);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;
    try {
      await deletePost(id);
      toast.success('Đã xóa bài viết thành công!');
      router.push('/blog');
    } catch (err) {
      toast.error('Lỗi khi xóa bài viết: ' + err.message);
      console.error(err);
    }
  };

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
    handleResetZoom();
  };

  const handleZoomIn = () => {
    setLightboxScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setLightboxScale(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) {
        setLightboxPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setLightboxScale(1);
    setLightboxPosition({ x: 0, y: 0 });
  };

  const handlePrevLightboxImage = (e) => {
    e.stopPropagation();
    handleResetZoom();
    setActiveMediaIndex((prev) => (prev === 0 ? post.media.length - 1 : prev - 1));
  };

  const handleNextLightboxImage = (e) => {
    e.stopPropagation();
    handleResetZoom();
    setActiveMediaIndex((prev) => (prev === post.media.length - 1 ? 0 : prev + 1));
  };

  const handlePanStart = (e) => {
    if (lightboxScale <= 1) return;
    setIsPanning(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setPanStart({
      x: clientX - lightboxPosition.x,
      y: clientY - lightboxPosition.y
    });
  };

  const handlePanMove = (e) => {
    if (!isPanning || lightboxScale <= 1) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setLightboxPosition({
      x: clientX - panStart.x,
      y: clientY - panStart.y
    });
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

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
            {isEditing ? (
              <form onSubmit={handleSaveEdit} style={{ padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem', color: '#0f172a' }}>Chỉnh sửa bài viết</h2>
                
                {/* Title */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Tiêu đề
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.7rem 1rem',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      fontSize: '1rem',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Content */}
                {post.type !== 'poll' && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                      Nội dung
                    </label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      required
                      rows={6}
                      style={{
                        width: '100%',
                        padding: '0.7rem 1rem',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        fontSize: '0.9rem',
                        outline: 'none',
                        resize: 'vertical',
                        lineHeight: 1.6,
                      }}
                    />
                  </div>
                )}

                {/* Category & Flair */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                      Danh mục
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    >
                      <option value="general">💬 Tổng hợp</option>
                      <option value="housing">🏠 Nhà trọ</option>
                      <option value="food">🍜 Ẩm thực</option>
                      <option value="academic">📚 Học tập</option>
                      <option value="social">🎉 Xã hội</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                      Flair
                    </label>
                    <select
                      value={editFlair || ''}
                      onChange={(e) => setEditFlair(e.target.value || null)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.85rem',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    >
                      <option value="">Không có</option>
                      <option value="DISCUSSION">DISCUSSION</option>
                      <option value="QUESTION">QUESTION</option>
                      <option value="REVIEW">REVIEW</option>
                      <option value="URGENT">URGENT</option>
                      <option value="ANNOUNCEMENT">ANNOUNCEMENT</option>
                    </select>
                  </div>
                </div>

                {/* Anonymous Toggle */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  background: '#f8fafc',
                  borderRadius: '0.75rem',
                  border: '1.5px solid #e2e8f0',
                  marginBottom: '1.5rem',
                }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>🕵️ Đăng ẩn danh</span>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={editIsAnonymous}
                      onChange={(e) => setEditIsAnonymous(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', inset: 0,
                      backgroundColor: editIsAnonymous ? '#3b82f6' : '#cbd5e1',
                      borderRadius: '24px', transition: '0.3s',
                    }}>
                      <span style={{
                        position: 'absolute', content: '""', height: '18px', width: '18px',
                        left: editIsAnonymous ? '26px' : '3px', bottom: '3px',
                        backgroundColor: '#fff', borderRadius: '50%', transition: '0.3s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </span>
                  </label>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', justifyContent: 'end', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    style={{
                      padding: '0.6rem 1.25rem',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '0.75rem',
                      background: '#fff',
                      color: '#64748b',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '0.6rem 1.25rem',
                      border: 'none',
                      borderRadius: '0.75rem',
                      background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Media Gallery / Slideshow */}
                {post.media && post.media.length > 0 ? (
                  <div className="pd-media-carousel">
                    <div className="pd-media-viewer" style={{ position: 'relative' }}>
                      {post.media[activeMediaIndex].type === 'video' ? (
                        <video
                          key={activeMediaIndex}
                          src={post.media[activeMediaIndex].url}
                          className="pd-media-main-video"
                          controls
                          autoPlay={false}
                          muted
                          playsInline
                        />
                      ) : (
                        <>
                          <img
                            src={post.media[activeMediaIndex].url}
                            alt={`Media ${activeMediaIndex + 1}`}
                            className="pd-media-main-img"
                            onClick={() => setIsLightboxOpen(true)}
                            style={{ cursor: 'zoom-in' }}
                          />

                          <button
                            onClick={() => setIsLightboxOpen(true)}
                            className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors z-20 border-none"
                            title="Phóng to ảnh"
                            style={{ cursor: 'pointer' }}
                          >
                            🔍
                          </button>
                        </>
                      )}

                      {post.media.length > 1 && (
                        <>
                          <button
                            onClick={() => setActiveMediaIndex((prev) => (prev === 0 ? post.media.length - 1 : prev - 1))}
                            className="pd-carousel-nav pd-carousel-prev"
                            title="Ảnh trước"
                          >
                            ‹
                          </button>
                          <button
                            onClick={() => setActiveMediaIndex((prev) => (prev === post.media.length - 1 ? 0 : prev + 1))}
                            className="pd-carousel-nav pd-carousel-next"
                            title="Ảnh sau"
                          >
                            ›
                          </button>
                        </>
                      )}
                    </div>

                    {post.media.length > 1 && (
                      <div className="pd-media-thumbnails">
                        {post.media.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveMediaIndex(idx)}
                            className={`pd-thumbnail-btn ${idx === activeMediaIndex ? 'active' : ''}`}
                          >
                            {item.type === 'video' ? (
                              <div className="pd-thumbnail-video-wrap">
                                <video src={item.url} muted playsInline />
                                <span className="pd-thumbnail-video-icon">▶</span>
                              </div>
                            ) : (
                              <img src={item.url} alt={`Thumbnail ${idx + 1}`} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : post.imageUrl ? (
                  <img src={post.imageUrl} alt={post.title} className="pd-image" />
                ) : null}

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
                        {!post.isAnonymous && post.authorBadges && post.authorBadges.map((badge, idx) => (
                          <span key={idx} title={badge.name} style={{ marginLeft: '0.25rem', fontSize: '0.9rem', cursor: 'help' }}>
                            {badge.icon}
                          </span>
                        ))}
                        {post.isAnonymous && isAdmin && (
                          <span style={{ color: '#ef4444', fontWeight: 600, marginLeft: '0.25rem' }}>
                            (Bởi: {post.realAuthorName || 'Chưa rõ'})
                          </span>
                        )}
                      </span>
                      <span className="pd-dot">•</span>
                      <span className="pd-time">{timeAgo(post.createdAt)}</span>
                      
                      {user && (post.userId === user.uid || isAdmin) && (
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
                          <button onClick={startEditing} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>Sửa</button>
                          <span style={{ color: '#cbd5e1' }}>|</span>
                          <button onClick={handleDelete} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>Xóa</button>
                        </div>
                      )}
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
              </>
            )}
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

          {/* Lightbox Modal with Zoom & Pan */}
          {isLightboxOpen && (
            <div 
              className="fixed inset-0 bg-black/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center select-none"
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleCloseLightbox();
              }}
              tabIndex={0}
              style={{ outline: 'none' }}
            >
              {/* Close Button */}
              <button
                onClick={handleCloseLightbox}
                className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-colors border-none cursor-pointer z-50"
                title="Đóng (Esc)"
              >
                ✕
              </button>

              {/* Carousel Navigation in Lightbox */}
              {post.media && post.media.length > 1 && (
                <>
                  <button
                    onClick={handlePrevLightboxImage}
                    className="absolute left-6 top-1/2 -translate-y-1/2 text-white bg-white/10 hover:bg-white/20 w-14 h-14 rounded-full flex items-center justify-center text-3xl transition-colors border-none cursor-pointer z-50"
                    title="Ảnh trước"
                  >
                    ‹
                  </button>
                  <button
                    onClick={handleNextLightboxImage}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-white bg-white/10 hover:bg-white/20 w-14 h-14 rounded-full flex items-center justify-center text-3xl transition-colors border-none cursor-pointer z-50"
                    title="Ảnh sau"
                  >
                    ›
                  </button>
                </>
              )}

              {/* Large Media Container */}
              <div 
                className="relative w-full h-[80vh] flex items-center justify-center overflow-hidden"
                onMouseMove={handlePanMove}
                onMouseUp={handlePanEnd}
                onMouseLeave={handlePanEnd}
                onTouchMove={handlePanMove}
                onTouchEnd={handlePanEnd}
              >
                {post.media[activeMediaIndex].type === 'video' ? (
                  <video
                    key={activeMediaIndex}
                    src={post.media[activeMediaIndex].url}
                    style={{
                      maxHeight: '100%',
                      maxWidth: '100%',
                      objectFit: 'contain',
                    }}
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <img
                    src={post.media[activeMediaIndex].url}
                    alt="Zoomed media"
                    style={{
                      maxHeight: '100%',
                      maxWidth: '100%',
                      objectFit: 'contain',
                      transform: `translate(${lightboxPosition.x}px, ${lightboxPosition.y}px) scale(${lightboxScale})`,
                      transition: isPanning ? 'none' : 'transform 0.2s cubic-bezier(0.1, 0.76, 0.55, 0.94)',
                      cursor: lightboxScale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in',
                      userSelect: 'none',
                      touchAction: lightboxScale > 1 ? 'none' : 'auto',
                    }}
                    onMouseDown={handlePanStart}
                    onTouchStart={handlePanStart}
                    onClick={(e) => {
                      if (lightboxScale === 1) {
                        setLightboxScale(2);
                      } else {
                        handleResetZoom();
                      }
                    }}
                  />
                )}
              </div>

              {/* Zoom Control Bar (only show if it is an image) */}
              {post.media[activeMediaIndex].type !== 'video' && (
                <div className="absolute bottom-8 bg-black/60 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-6 z-50 text-white text-sm">
                  <button 
                    onClick={handleZoomOut}
                    className="bg-transparent border-none text-white text-lg hover:text-blue-400 cursor-pointer disabled:opacity-30 transition-colors"
                    disabled={lightboxScale <= 1}
                    title="Thu nhỏ"
                  >
                    ➖
                  </button>
                  
                  <button 
                    onClick={handleResetZoom}
                    className="bg-white/10 hover:bg-white/20 border-none text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    title="Khôi phục kích thước"
                  >
                    🔍 {Math.round(lightboxScale * 100)}%
                  </button>

                  <button 
                    onClick={handleZoomIn}
                    className="bg-transparent border-none text-white text-lg hover:text-blue-400 cursor-pointer disabled:opacity-30 transition-colors"
                    disabled={lightboxScale >= 4}
                    title="Phóng to"
                  >
                    ➕
                  </button>
                </div>
              )}

              {/* Image index counter */}
              <div className="absolute top-8 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium">
                Tệp {activeMediaIndex + 1} / {post.media.length}
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
