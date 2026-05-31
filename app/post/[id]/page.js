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
import { getPostById, likePost, bookmarkPost, sharePost, incrementViewCount, votePoll, updatePost, deletePost } from '@/lib/firestore';
import toast from 'react-hot-toast';
import { uploadToCloudinary } from '@/lib/cloudinary';

const compressImage = (file) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    console.log(`[Compression] Starting for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  console.log("[Compression] Failed to generate blob, using original file");
                  resolve(file);
                  return;
                }
                try {
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  console.log(`[Compression] Success: ${file.name} compressed from ${(file.size / 1024 / 1024).toFixed(2)} MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
                  resolve(compressedFile);
                } catch (fileErr) {
                  console.warn("[Compression] File constructor failed, using Blob fallback:", fileErr);
                  blob.name = file.name;
                  resolve(blob);
                }
              },
              'image/jpeg',
              0.75
            );
          } catch (canvasErr) {
            console.error("[Compression] Canvas operations failed, using original file:", canvasErr);
            resolve(file);
          }
        };
        img.onerror = (imgErr) => {
          console.error("[Compression] Image load failed, using original file:", imgErr);
          resolve(file);
        };
        img.src = event.target.result;
      };
      reader.onerror = (readerErr) => {
        console.error("[Compression] FileReader failed, using original file:", readerErr);
        resolve(file);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("[Compression] Unhandled exception, using original file:", err);
      resolve(file);
    }
  });
};

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

function formatCount(num) {
  if (!num || num === 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + 'K';
  return num.toString();
}

export default function PostDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const [voted, setVoted] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // Lightbox
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxScale, setLightboxScale] = useState(1);
  const [lightboxPosition, setLightboxPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Edit & Delete
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('general');
  const [editFlair, setEditFlair] = useState('');
  const [editIsAnonymous, setEditIsAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentMediaList, setCurrentMediaList] = useState([]);
  const [editMediaFiles, setEditMediaFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState('');

  useEffect(() => {
    return () => {
      editMediaFiles.forEach(item => {
        if (item.preview && item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [editMediaFiles]);

  const startEditing = () => {
    if (!post) return;
    setEditTitle(post.title || '');
    setEditContent(post.content || '');
    setEditCategory(post.category || 'general');
    setEditFlair(post.flair || '');
    setEditIsAnonymous(post.isAnonymous || false);

    let initialMedia = post.media || [];
    if (initialMedia.length === 0 && post.imageUrl) {
      initialMedia = [{ type: 'image', url: post.imageUrl }];
    }
    setCurrentMediaList(initialMedia);
    setEditMediaFiles([]);
    setUploadProgress({});
    setUploadStatus('');
    setIsEditing(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return toast.error('Vui lòng nhập tiêu đề');
    if (post.type !== 'poll' && !editContent.trim()) return toast.error('Vui lòng nhập nội dung');
    setSaving(true);
    setUploadStatus('Đang bắt đầu...');
    try {
      // 1. Upload any new media files
      const uploadedItems = [];
      for (let i = 0; i < editMediaFiles.length; i++) {
        const item = editMediaFiles[i];
        setUploadStatus(`Tải file ${i + 1}/${editMediaFiles.length}...`);
        
        let fileToUpload = item.file;
        if (item.type === 'image') {
          fileToUpload = await compressImage(item.file);
        }
        
        const uploadedItem = await uploadToCloudinary(fileToUpload, (progress) => {
          setUploadProgress((prev) => ({ ...prev, [i]: Math.round(progress) }));
        });
        uploadedItems.push(uploadedItem);
      }

      // 2. Merge existing remaining media and new uploaded media
      const mergedMedia = [...currentMediaList, ...uploadedItems];

      // 3. Prepare updated data
      const updatedData = {
        title: editTitle.trim(),
        category: editCategory,
        flair: editFlair || null,
        isAnonymous: editIsAnonymous,
        media: mergedMedia,
        imageUrl: mergedMedia.length > 0 && mergedMedia[0].type === 'image' ? mergedMedia[0].url : (mergedMedia.length > 0 ? null : null),
      };
      if (post.type !== 'poll') updatedData.content = editContent.trim();

      setUploadStatus('Đang lưu...');
      await updatePost(id, updatedData);
      toast.success('Đã cập nhật!');
      setIsEditing(false);
      await fetchPost();
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    } finally {
      setSaving(false);
      setUploadStatus('');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này?')) return;
    try {
      await deletePost(id);
      toast.success('Đã xóa!');
      router.push('/blog');
    } catch (err) {
      toast.error('Lỗi: ' + err.message);
    }
  };

  // Lightbox handlers
  const handleCloseLightbox = () => { setIsLightboxOpen(false); handleResetZoom(); };
  const handleZoomIn = () => setLightboxScale(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => {
    setLightboxScale(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setLightboxPosition({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => { setLightboxScale(1); setLightboxPosition({ x: 0, y: 0 }); };

  const handlePanStart = (e) => {
    if (lightboxScale <= 1) return;
    setIsPanning(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setPanStart({ x: clientX - lightboxPosition.x, y: clientY - lightboxPosition.y });
  };
  const handlePanMove = (e) => {
    if (!isPanning || lightboxScale <= 1) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setLightboxPosition({ x: clientX - panStart.x, y: clientY - panStart.y });
  };
  const handlePanEnd = () => setIsPanning(false);

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
    } finally {
      setLoading(false);
    }
  };

  const { user, isAdmin } = useUserRole();
  const hasLiked = post?.likedBy?.includes(user?.uid) || post?.upvotedBy?.includes(user?.uid);
  const hasBookmarked = post?.bookmarkedBy?.includes(user?.uid);
  const likeCount = post?.likes || post?.upvotes || 0;
  const cat = CATEGORY_MAP[post?.category] || CATEGORY_MAP.general;

  const handleLike = async () => {
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (liking) return;
    setLiking(true);
    try {
      await likePost(id, user.uid);
      fetchPost();
    } catch (e) {
      toast.error('Lỗi');
    } finally {
      setLiking(false);
    }
  };

  const handleBookmark = async () => {
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (bookmarking) return;
    setBookmarking(true);
    try {
      const result = await bookmarkPost(id, user.uid);
      toast.success(result ? 'Đã lưu' : 'Đã bỏ lưu');
      fetchPost();
    } catch (e) {
      toast.error('Lỗi');
    } finally {
      setBookmarking(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Đã sao chép liên kết');
      sharePost(id).catch(() => {});
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  const handleVotePoll = async (optionIndex) => {
    if (!user) return toast.error('Vui lòng đăng nhập');
    try {
      await votePoll(id, optionIndex, user.uid);
      setVoted(true);
      fetchPost();
      toast.success('Đã bình chọn!');
    } catch (error) {
      toast.error('Lỗi');
    }
  };

  if (loading) {
    return (
      <div className="blog-root">
        <Navbar />
        <div className="blog-loading" style={{ padding: '4rem' }}>
          <div className="blog-spinner" style={{ width: '2.5rem', height: '2.5rem' }}></div>
        </div>
      </div>
    );
  }

  if (!post) return null;

  const totalVotes = post.pollData?.options?.reduce((sum, o) => sum + (o.votes || 0), 0) || 0;

  // Action bar button component
  const ActionBtn = ({ icon, count, active, activeColor, hoverBg, onClick, title }) => (
    <div className={`tc-action-group ${active ? 'liked' : ''}`}>
      <button
        onClick={onClick}
        className="tc-action-btn"
        title={title}
        style={{
          color: active ? activeColor : 'var(--blog-text-secondary)',
          padding: '0.6rem',
          borderRadius: '50%',
        }}
      >
        {icon}
      </button>
      {count !== undefined && (
        <span className="tc-action-count" style={{ color: active ? activeColor : 'var(--blog-text-secondary)', fontSize: '0.85rem' }}>
          {formatCount(count)}
        </span>
      )}
    </div>
  );

  return (
    <ProtectedRoute>
      <div className="blog-root">
        <Navbar />
        <main style={{ maxWidth: '600px', margin: '0 auto', borderLeft: '1px solid var(--blog-divider)', borderRight: '1px solid var(--blog-divider)', minHeight: '100vh' }}>
          {/* Back */}
          <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1.5rem', position: 'sticky', top: '64px', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 20, borderBottom: '1px solid var(--blog-divider)' }}>
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blog-text-primary)', fontSize: '1.25rem', padding: '0.25rem', borderRadius: '50%', display: 'flex' }}>
              ←
            </button>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--blog-text-primary)' }}>Bài viết</span>
          </div>

          {/* Post card */}
          <div className="pd-card">
            {isEditing ? (
              <form onSubmit={handleSaveEdit} style={{ padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--blog-text-primary)' }}>Chỉnh sửa bài viết</h2>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Tiêu đề</label>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required style={{ width: '100%', padding: '0.7rem 1rem', border: '1.5px solid var(--blog-divider)', borderRadius: '0.75rem', fontSize: '1rem', fontWeight: 600, outline: 'none', background: 'var(--blog-input-bg)', color: 'var(--blog-text-primary)', fontFamily: 'inherit' }} />
                </div>
                {post.type !== 'poll' && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Nội dung</label>
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} required rows={6} style={{ width: '100%', padding: '0.7rem 1rem', border: '1.5px solid var(--blog-divider)', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none', resize: 'vertical', lineHeight: 1.6, background: 'var(--blog-input-bg)', color: 'var(--blog-text-primary)', fontFamily: 'inherit' }} />
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Danh mục</label>
                    <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid var(--blog-divider)', borderRadius: '0.75rem', fontSize: '0.85rem', outline: 'none', background: 'var(--blog-input-bg)', color: 'var(--blog-text-primary)', fontFamily: 'inherit' }}>
                      <option value="general">💬 Tổng hợp</option>
                      <option value="housing">🏠 Nhà trọ</option>
                      <option value="food">🍜 Ẩm thực</option>
                      <option value="academic">📚 Học tập</option>
                      <option value="social">🎉 Xã hội</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Flair</label>
                    <select value={editFlair || ''} onChange={(e) => setEditFlair(e.target.value || null)} style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1.5px solid var(--blog-divider)', borderRadius: '0.75rem', fontSize: '0.85rem', outline: 'none', background: 'var(--blog-input-bg)', color: 'var(--blog-text-primary)', fontFamily: 'inherit' }}>
                      <option value="">Không có</option>
                      <option value="DISCUSSION">DISCUSSION</option>
                      <option value="QUESTION">QUESTION</option>
                      <option value="REVIEW">REVIEW</option>
                      <option value="URGENT">URGENT</option>
                      <option value="ANNOUNCEMENT">ANNOUNCEMENT</option>
                    </select>
                  </div>
                </div>

                {/* Media Edit Section */}
                {post.type !== 'poll' && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                      Hình ảnh & Video hiện tại
                    </label>
                    {currentMediaList.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--blog-text-secondary)', fontStyle: 'italic', margin: '0.5rem 0' }}>Không có hình ảnh hoặc video nào.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                        {currentMediaList.map((item, idx) => (
                          <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '0.5rem', overflow: 'hidden', border: '1.5px solid var(--blog-divider)', background: '#000' }}>
                            {item.type === 'video' ? (
                              <video src={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                            ) : (
                              <img src={item.url} alt={`Current ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentMediaList(prev => prev.filter((_, i) => i !== idx));
                              }}
                              style={{
                                position: 'absolute', top: '2px', right: '2px', background: 'rgba(239, 68, 68, 0.85)',
                                color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px',
                                display: 'flex', alignItems: 'center', justify: 'center', fontSize: '10px', cursor: 'pointer',
                                fontWeight: 'bold', zIndex: 10
                              }}
                            >
                              ✕
                            </button>
                            {item.type === 'video' && (
                              <span style={{ position: 'absolute', bottom: '2px', left: '2px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '8px', padding: '1px 3px', borderRadius: '2px' }}>
                                🎥 Video
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blog-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                      Tải thêm hình ảnh/video mới (tối đa 9 files tổng cộng)
                    </label>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (currentMediaList.length + editMediaFiles.length + files.length > 9) {
                          toast.error('Tổng số lượng ảnh/video không được vượt quá 9!');
                          return;
                        }
                        const newFiles = files.map((file) => ({
                          file,
                          type: file.type.startsWith('video/') ? 'video' : 'image',
                          preview: URL.createObjectURL(file),
                        }));
                        setEditMediaFiles(prev => [...prev, ...newFiles]);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0',
                        fontSize: '0.85rem',
                        color: 'var(--blog-text-secondary)',
                      }}
                    />

                    {/* New Previews Grid */}
                    {editMediaFiles.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {editMediaFiles.map((item, idx) => (
                          <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '0.5rem', overflow: 'hidden', border: '1.5px solid var(--blog-divider)', background: '#000' }}>
                            {item.type === 'video' ? (
                              <video src={item.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                            ) : (
                              <img src={item.preview} alt={`New Preview ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                URL.revokeObjectURL(item.preview);
                                setEditMediaFiles((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              style={{
                                position: 'absolute', top: '2px', right: '2px', background: 'rgba(239, 68, 68, 0.85)',
                                color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px',
                                display: 'flex', alignItems: 'center', justify: 'center', fontSize: '10px', cursor: 'pointer',
                                fontWeight: 'bold', zIndex: 10
                              }}
                            >
                              ✕
                            </button>
                            {item.type === 'video' && (
                              <span style={{ position: 'absolute', bottom: '2px', left: '2px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '8px', padding: '1px 3px', borderRadius: '2px' }}>
                                🎥 Video
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'end', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setIsEditing(false)} style={{ padding: '0.6rem 1.25rem', border: '1px solid var(--blog-divider)', borderRadius: '2rem', background: 'none', color: 'var(--blog-text-secondary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' }}>Hủy</button>
                  <button type="submit" disabled={saving} style={{ padding: '0.6rem 1.25rem', border: 'none', borderRadius: '2rem', background: 'var(--blog-accent)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit' }}>
                    {saving ? (uploadStatus || 'Đang lưu...') : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Media */}
                {post.media && post.media.length > 0 ? (
                  <div className="pd-media-carousel">
                    <div className="pd-media-viewer" style={{ position: 'relative' }}>
                      {post.media[activeMediaIndex].type === 'video' ? (
                        <video key={activeMediaIndex} src={post.media[activeMediaIndex].url} className="pd-media-main-video" controls muted playsInline />
                      ) : (
                        <img src={post.media[activeMediaIndex].url} alt={`Media ${activeMediaIndex + 1}`} className="pd-media-main-img" onClick={() => setIsLightboxOpen(true)} style={{ cursor: 'zoom-in' }} />
                      )}
                      {post.media.length > 1 && (
                        <>
                          <button onClick={() => setActiveMediaIndex((prev) => (prev === 0 ? post.media.length - 1 : prev - 1))} className="pd-carousel-nav pd-carousel-prev">‹</button>
                          <button onClick={() => setActiveMediaIndex((prev) => (prev === post.media.length - 1 ? 0 : prev + 1))} className="pd-carousel-nav pd-carousel-next">›</button>
                        </>
                      )}
                    </div>
                    {post.media.length > 1 && (
                      <div className="pd-media-thumbnails">
                        {post.media.map((item, idx) => (
                          <button key={idx} onClick={() => setActiveMediaIndex(idx)} className={`pd-thumbnail-btn ${idx === activeMediaIndex ? 'active' : ''}`}>
                            {item.type === 'video' ? (
                              <div className="pd-thumbnail-video-wrap">
                                <video src={item.url} muted playsInline />
                                <span className="pd-thumbnail-video-icon">▶</span>
                              </div>
                            ) : (
                              <img src={item.url} alt={`Thumb ${idx + 1}`} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : post.imageUrl ? (
                  <img src={post.imageUrl} alt={post.title} className="pd-image" />
                ) : null}

                {/* Post header */}
                <div style={{ padding: '1rem 1rem 0' }}>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {/* Avatar */}
                    {post.isAnonymous ? (
                      <div className="tc-avatar" style={{ background: '#536471' }}>👤</div>
                    ) : post.userId ? (
                      <Link href={`/profile?uid=${post.userId}`} className="tc-avatar-link" style={{ textDecoration: 'none' }}>
                        {post.authorAvatar ? (
                          <div className="tc-avatar hover:scale-105 transition-transform"><img src={post.authorAvatar} alt={displayName(post.authorName)} /></div>
                        ) : (
                          <div className="tc-avatar hover:scale-105 transition-transform">{displayName(post.authorName).charAt(0).toUpperCase()}</div>
                        )}
                      </Link>
                    ) : post.authorAvatar ? (
                      <div className="tc-avatar"><img src={post.authorAvatar} alt={displayName(post.authorName)} /></div>
                    ) : (
                      <div className="tc-avatar">{displayName(post.authorName).charAt(0).toUpperCase()}</div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {!post.isAnonymous && post.userId ? (
                          <Link href={`/profile?uid=${post.userId}`} className="tc-author-link" style={{ textDecoration: 'none' }}>
                            <span style={{ fontWeight: 700, color: 'var(--blog-text-primary)', fontSize: '0.94rem' }} className="hover:underline">
                              {displayName(post.authorName)}
                              {post.authorBadges && post.authorBadges.map((badge, idx) => (
                                <span key={idx} title={badge.name} style={{ marginLeft: '0.2rem', fontSize: '0.85rem' }}>{badge.icon}</span>
                              ))}
                            </span>
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 700, color: 'var(--blog-text-primary)', fontSize: '0.94rem' }}>
                            {displayName(post.authorName)}
                            {!post.isAnonymous && post.authorBadges && post.authorBadges.map((badge, idx) => (
                              <span key={idx} title={badge.name} style={{ marginLeft: '0.2rem', fontSize: '0.85rem' }}>{badge.icon}</span>
                            ))}
                          </span>
                        )}
                        {post.isAnonymous && isAdmin && (
                          <span style={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 600 }}>({post.realAuthorName || '?'})</span>
                        )}

                        <span style={{ color: 'var(--blog-text-tertiary)', fontSize: '0.25rem' }}>•</span>
                        <span style={{ color: 'var(--blog-text-secondary)', fontSize: '0.88rem' }}>{timeAgo(post.createdAt)}</span>

                        {user && (post.userId === user.uid || isAdmin) && (
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
                            <button onClick={startEditing} style={{ background: 'none', border: 'none', color: 'var(--blog-accent)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', fontFamily: 'inherit' }}>Sửa</button>
                            <button onClick={handleDelete} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', fontFamily: 'inherit' }}>Xóa</button>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.15rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span className="tc-category">{cat.emoji} {cat.label}</span>
                        {post.flair && <FlairBadge flair={post.flair} />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reference Location Banner */}
                {post.locationId && post.locationName && (
                  <div style={{ padding: '0.75rem 1rem 0' }}>
                    <Link
                      href={`/location/${post.locationId}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(99, 102, 241, 0.08)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        padding: '0.6rem 0.85rem',
                        borderRadius: '0.75rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#6366f1',
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                      }}
                    >
                      <span>📍 Bản đồ & Review:</span>
                      <span style={{ textDecoration: 'underline' }}>{post.locationName}</span>
                      <span>➔</span>
                    </Link>
                  </div>
                )}

                {/* Title */}
                <div style={{ padding: '0.5rem 1rem 0' }}>
                  <h1 className="pd-title">{post.title}</h1>
                </div>

                {/* Body */}
                <div className="pd-body">
                  {post.type === 'poll' ? (
                    <div style={{ padding: '1rem', background: 'rgba(29,155,240,0.06)', borderRadius: '1rem', border: '1px solid rgba(29,155,240,0.15)' }}>
                      <p style={{ fontWeight: 700, color: 'var(--blog-accent)', marginBottom: '1rem' }}>
                        🗳️ {post.pollData?.question || post.title}
                      </p>
                      {post.pollData?.options?.map((opt, idx) => {
                        const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                        return (
                          <div key={idx} onClick={() => !voted && handleVotePoll(idx)} style={{
                            position: 'relative', height: '3rem', background: 'var(--blog-input-bg)', borderRadius: '0.75rem',
                            overflow: 'hidden', border: '1px solid var(--blog-divider)', marginBottom: '0.5rem', cursor: voted ? 'default' : 'pointer',
                          }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: 'rgba(29,155,240,0.15)', width: `${percent}%`, transition: 'width 0.5s' }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', fontSize: '0.9rem', fontWeight: 500, color: 'var(--blog-text-primary)' }}>
                              <span>{opt.text}</span>
                              <span style={{ fontWeight: 700, color: 'var(--blog-accent)' }}>{percent}%</span>
                            </div>
                          </div>
                        );
                      })}
                      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--blog-text-secondary)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                        {totalVotes > 0 ? `${totalVotes} lượt bình chọn` : 'Hãy bình chọn!'}
                      </p>
                    </div>
                  ) : (
                    <div className="pd-text">
                      {post.content?.split(/(#\w+)/g).map((part, i) =>
                        part.startsWith('#') ? (
                          <Link key={i} href={`/blog/tag/${part.substring(1).toLowerCase()}`} style={{ color: 'var(--blog-accent)', fontWeight: 600 }}>{part}</Link>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* Stats row */}
                <div className="pd-stats">
                  <span><span className="stat-count">{formatCount(post.commentCount || 0)}</span> bình luận</span>
                  <span><span className="stat-count">{formatCount(likeCount)}</span> lượt thích</span>
                  <span><span className="stat-count">{formatCount(post.viewCount || 0)}</span> lượt xem</span>
                  {(post.shares || 0) > 0 && <span><span className="stat-count">{formatCount(post.shares)}</span> chia sẻ</span>}
                </div>

                {/* Action bar */}
                <div className="pd-action-bar">
                  <ActionBtn
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>}
                    title="Bình luận"
                    onClick={() => document.querySelector('.ct-new-input')?.focus()}
                  />
                  <ActionBtn
                    icon={hasLiked
                      ? <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--blog-like-color)"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                      : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                    }
                    active={hasLiked}
                    activeColor="var(--blog-like-color)"
                    title={hasLiked ? 'Bỏ thích' : 'Thích'}
                    onClick={handleLike}
                  />
                  <ActionBtn
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16,6 12,2 8,6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>}
                    title="Chia sẻ"
                    onClick={handleShare}
                  />
                  <ActionBtn
                    icon={hasBookmarked
                      ? <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--blog-bookmark-color)"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                      : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                    }
                    active={hasBookmarked}
                    activeColor="var(--blog-bookmark-color)"
                    title={hasBookmarked ? 'Bỏ lưu' : 'Lưu bài'}
                    onClick={handleBookmark}
                  />
                </div>
              </>
            )}
          </div>

          {/* Comments */}
          <div className="pd-comments">
            <h2 className="pd-comments-header">Thảo luận ({post.commentCount || 0})</h2>
            <CommentThread comments={post.comments || []} postId={id} onRefresh={fetchPost} />
          </div>

          {/* Lightbox */}
          {isLightboxOpen && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Escape') handleCloseLightbox(); }}
            >
              <button onClick={handleCloseLightbox} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '3rem', height: '3rem', borderRadius: '50%', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>✕</button>

              {post.media && post.media.length > 1 && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); handleResetZoom(); setActiveMediaIndex(prev => prev === 0 ? post.media.length - 1 : prev - 1); }} style={{ position: 'absolute', left: '1.5rem', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '3.5rem', height: '3.5rem', borderRadius: '50%', fontSize: '2rem', cursor: 'pointer', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                  <button onClick={(e) => { e.stopPropagation(); handleResetZoom(); setActiveMediaIndex(prev => prev === post.media.length - 1 ? 0 : prev + 1); }} style={{ position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '3.5rem', height: '3.5rem', borderRadius: '50%', fontSize: '2rem', cursor: 'pointer', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                </>
              )}

              <div style={{ position: 'relative', width: '100%', height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                onMouseMove={handlePanMove} onMouseUp={handlePanEnd} onMouseLeave={handlePanEnd} onTouchMove={handlePanMove} onTouchEnd={handlePanEnd}
              >
                {post.media[activeMediaIndex].type === 'video' ? (
                  <video key={activeMediaIndex} src={post.media[activeMediaIndex].url} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} controls autoPlay playsInline />
                ) : (
                  <img
                    src={post.media[activeMediaIndex].url}
                    alt="Zoomed"
                    style={{
                      maxHeight: '100%', maxWidth: '100%', objectFit: 'contain',
                      transform: `translate(${lightboxPosition.x}px, ${lightboxPosition.y}px) scale(${lightboxScale})`,
                      transition: isPanning ? 'none' : 'transform 0.2s',
                      cursor: lightboxScale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in',
                      userSelect: 'none',
                    }}
                    onMouseDown={handlePanStart} onTouchStart={handlePanStart}
                    onClick={() => { if (lightboxScale === 1) setLightboxScale(2); else handleResetZoom(); }}
                  />
                )}
              </div>

              {post.media[activeMediaIndex].type !== 'video' && (
                <div style={{ position: 'absolute', bottom: '2rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', zIndex: 50, color: '#fff', fontSize: '0.85rem' }}>
                  <button onClick={handleZoomOut} disabled={lightboxScale <= 1} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', opacity: lightboxScale <= 1 ? 0.3 : 1 }}>➖</button>
                  <button onClick={handleResetZoom} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>🔍 {Math.round(lightboxScale * 100)}%</button>
                  <button onClick={handleZoomIn} disabled={lightboxScale >= 4} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', opacity: lightboxScale >= 4 ? 0.3 : 1 }}>➕</button>
                </div>
              )}

              <div style={{ position: 'absolute', top: '2rem', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', fontWeight: 500 }}>
                {activeMediaIndex + 1} / {post.media.length}
              </div>
            </div>
          )}

          {/* Floating mobile action bar */}
          <div className="pd-floating-bar">
            <button onClick={() => document.querySelector('.ct-new-input')?.focus()} style={{ background: 'none', border: 'none', color: 'var(--blog-text-secondary)', padding: '0.5rem', cursor: 'pointer', fontSize: '1.15rem' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            </button>
            <button onClick={handleLike} style={{ background: 'none', border: 'none', color: hasLiked ? 'var(--blog-like-color)' : 'var(--blog-text-secondary)', padding: '0.5rem', cursor: 'pointer', fontSize: '1.15rem' }}>
              {hasLiked
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
              }
            </button>
            <button onClick={handleShare} style={{ background: 'none', border: 'none', color: 'var(--blog-text-secondary)', padding: '0.5rem', cursor: 'pointer', fontSize: '1.15rem' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16,6 12,2 8,6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
            </button>
            <button onClick={handleBookmark} style={{ background: 'none', border: 'none', color: hasBookmarked ? 'var(--blog-bookmark-color)' : 'var(--blog-text-secondary)', padding: '0.5rem', cursor: 'pointer', fontSize: '1.15rem' }}>
              {hasBookmarked
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>
              }
            </button>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
