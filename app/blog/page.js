'use client';

import '@/app/styles/blog.css';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import ThreadCard from '@/components/ThreadCard';
import { getPosts, getTrendingTags, addPost, autoModerateContent } from '@/lib/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';
import toast from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import useUserRole from '@/lib/useUserRole';

const FEED_TABS = [
  { key: 'forYou', label: 'Dành cho bạn' },
  { key: 'trending', label: 'Thịnh hành' },
  { key: 'new', label: 'Mới nhất' },
];

const CATEGORIES = [
  { key: null, label: 'Tất cả', emoji: '🌐' },
  { key: 'housing', label: 'Nhà trọ', emoji: '🏠' },
  { key: 'food', label: 'Ẩm thực', emoji: '🍜' },
  { key: 'academic', label: 'Học tập', emoji: '📚' },
  { key: 'social', label: 'Xã hội', emoji: '🎉' },
  { key: 'general', label: 'Tổng hợp', emoji: '💬' },
  { key: 'safety', label: 'Cảnh báo', emoji: '⚠️' },
  { key: 'events', label: 'Sự kiện', emoji: '📅' },
  { key: 'feedback', label: 'Góp ý', emoji: '💡' },
];

export default function BlogList() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('forYou');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [user, setUser] = useState(null);
  const [trendingTags, setTrendingTags] = useState([]);
  const { role, isAdmin } = useUserRole();

  // Composer state
  const [composerText, setComposerText] = useState('');
  const [composerTitle, setComposerTitle] = useState('');
  const [composing, setComposing] = useState(false);
  const [showComposerTitle, setShowComposerTitle] = useState(false);
  const composerRef = useRef(null);

  // Composer image & category states
  const [composerImageFile, setComposerImageFile] = useState(null);
  const [composerPreviewUrl, setComposerPreviewUrl] = useState('');
  const [composerCategory, setComposerCategory] = useState('general');
  const [composerUploadStatus, setComposerUploadStatus] = useState('');

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else {
            setUserData({ name: u.displayName || u.email, badges: [] });
          }
        } catch (e) {
          setUserData({ name: u.displayName || u.email, badges: [] });
        }
      }
    });
    return () => unsub();
  }, []);

  // Fetch trending tags
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const tags = await getTrendingTags(6);
        setTrendingTags(tags);
      } catch (err) {
        console.error('Error fetching trending:', err);
      }
    };
    fetchTrending();
  }, []);

  // Fetch posts when tab, category, or user state changes
  useEffect(() => {
    fetchPosts();
  }, [activeTab, categoryFilter, user]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const sortBy = activeTab === 'new' ? 'new' : activeTab === 'trending' ? 'top' : 'hot';
      const data = await getPosts(sortBy, categoryFilter, 50, user?.uid);
      setPosts(data);
    } catch (error) {
      toast.error('Không thể tải bài viết');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const compressComposerImage = (file) => {
    return new Promise((resolve) => {
      if (!file || !file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              const MAX_WIDTH = 800;
              const MAX_HEIGHT = 800;
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
              canvas.toBlob((blob) => {
                if (!blob) {
                  resolve(file);
                  return;
                }
                try {
                  const compressedFile = new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                } catch (e) {
                  resolve(blob);
                }
              }, 'image/jpeg', 0.8);
            } catch (e) {
              resolve(file);
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      } catch (e) {
        resolve(file);
      }
    });
  };

  const handleComposerImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh!');
      return;
    }
    setComposerImageFile(file);
    setComposerPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveComposerImage = () => {
    setComposerImageFile(null);
    setComposerPreviewUrl('');
  };

  // Inline compose submit
  const handleQuickPost = async () => {
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (!composerText.trim()) return;
    setComposing(true);
    setComposerUploadStatus('Đang xử lý...');
    try {
      let finalImageUrl = null;

      if (composerImageFile) {
        setComposerUploadStatus('Đang nén ảnh...');
        const compressed = await compressComposerImage(composerImageFile);
        setComposerUploadStatus('Đang tải ảnh lên...');
        const uploadResult = await uploadToCloudinary(compressed);
        finalImageUrl = uploadResult.url;
      }

      const title = composerTitle.trim() || composerText.substring(0, 60);
      
      await addPost(
        user.uid,
        userData?.name || user.displayName || user.email,
        title,
        composerText,
        finalImageUrl,
        role,
        'discussion',
        composerCategory,
        null,
        false,
        userData?.avatarUrl || null,
        userData?.badges || [],
        []
      );

      const moderation = autoModerateContent(title + " " + composerText);
      const isApproved = role?.trim() === 'admin' || moderation.status === 'approved';

      if (isApproved) {
        toast.success('Đã đăng bài viết thành công! 🎉');
      } else {
        toast.success('Đã gửi! Bài viết đang chờ duyệt do chứa nội dung đáng ngờ. ⏳', { duration: 5000 });
      }

      setComposerText('');
      setComposerTitle('');
      setComposerImageFile(null);
      setComposerPreviewUrl('');
      setComposerCategory('general');
      setShowComposerTitle(false);
      fetchPosts();
    } catch (err) {
      toast.error(err.message || 'Lỗi đăng bài');
    } finally {
      setComposing(false);
      setComposerUploadStatus('');
    }
  };

  const userInitial = userData?.name?.charAt(0).toUpperCase() || user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';
  const userName = userData?.name || user?.displayName || user?.email?.split('@')[0] || 'Bạn';

  return (
    <ProtectedRoute>
      <div className="blog-root">
        <Navbar />

        <main style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: '0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 600px) 350px', gap: '0', justifyContent: 'center' }}>

            {/* ═══════ LEFT SIDEBAR ═══════ */}
            <aside style={{ display: 'none', position: 'sticky', top: '64px', height: 'fit-content', padding: '1rem 0.5rem 1rem 0' }}
              className="blog-left-sidebar"
            >
              {/* User card */}
              {userData && (
                <div className="blog-user-card">
                  <div className="blog-user-card-header">
                    <div className="blog-user-card-avatar">
                      {userData.avatarUrl ? (
                        <img src={userData.avatarUrl} alt={userName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : userInitial}
                    </div>
                    <div>
                      <div className="blog-user-card-name">{userName}</div>
                      <div className="blog-user-card-role">
                        {userData.role === 'admin' ? '🛡️ Quản trị viên' : '🎓 Sinh viên'}
                      </div>
                    </div>
                  </div>
                  {userData.badges && userData.badges.length > 0 && (
                    <div className="blog-user-card-badges">
                      {userData.badges.map((badge, i) => (
                        <span key={i} className="blog-user-card-badge" title={badge.name}>
                          {badge.icon} {badge.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <Link href="/profile" className="blog-user-card-link">
                    Hồ sơ của tôi
                  </Link>
                </div>
              )}

              {/* Category Filters Menu */}
              <div className="blog-sidebar" style={{ marginTop: '1rem' }}>
                <h3 className="blog-sidebar-title" style={{ fontSize: '0.94rem', fontWeight: 800, paddingBottom: '0.5rem', borderBottom: '1px solid var(--blog-divider)' }}>
                  🌐 Danh mục bài viết
                </h3>
                <div className="blog-sidebar-cat-list">
                  {CATEGORIES.map((cat) => {
                    const active = categoryFilter === cat.key;
                    return (
                      <button
                        key={cat.key || 'all'}
                        onClick={() => setCategoryFilter(cat.key)}
                        className={`blog-sidebar-cat-btn ${active ? 'active' : ''}`}
                      >
                        <span style={{ fontSize: '1.1rem' }}>{cat.emoji}</span>
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* ═══════ CENTER FEED ═══════ */}
            <div style={{ borderLeft: '1px solid var(--blog-divider)', borderRight: '1px solid var(--blog-divider)', minHeight: '100vh' }}>

              {/* Feed Tabs */}
              <div className="blog-feed-header">
                <div className="blog-feed-tabs">
                  {FEED_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`blog-feed-tab ${activeTab === tab.key ? 'active' : ''}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inline Composer */}
              <div className="blog-composer" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem', borderRadius: 'var(--blog-radius)', border: '1px solid var(--blog-divider)', background: 'var(--blog-card-bg)', margin: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div className="blog-composer-avatar">{userInitial}</div>
                  <div className="blog-composer-body">
                    {showComposerTitle && (
                      <input
                        type="text"
                        value={composerTitle}
                        onChange={(e) => setComposerTitle(e.target.value)}
                        placeholder="Tiêu đề bài viết..."
                        style={{
                          width: '100%',
                          background: 'none',
                          border: 'none',
                          outline: 'none',
                          color: 'var(--blog-text-primary)',
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          padding: '0.25rem 0',
                          marginBottom: '0.5rem',
                        }}
                      />
                    )}
                    <textarea
                      ref={composerRef}
                      className="blog-composer-input"
                      placeholder={`${userName} ơi, bạn đang nghĩ gì?`}
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      rows={1}
                      onFocus={() => setShowComposerTitle(true)}
                      style={{ minHeight: showComposerTitle ? '4rem' : '2.5rem' }}
                    />
                  </div>
                </div>

                {/* Image preview in composer */}
                {composerPreviewUrl && (
                  <div style={{ paddingLeft: '3.5rem', position: 'relative', marginTop: '0.5rem' }}>
                     <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid var(--blog-divider)' }}>
                       <img src={composerPreviewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       <button
                         type="button"
                         onClick={handleRemoveComposerImage}
                         style={{
                           position: 'absolute', top: '0.25rem', right: '0.25rem',
                           background: '#ef4444', color: '#fff', border: 'none',
                           borderRadius: '50%', width: '1.5rem', height: '1.5rem',
                           display: 'flex', alignItems: 'center', justifyContent: 'center',
                           fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold'
                         }}
                       >
                         ✕
                       </button>
                     </div>
                  </div>
                )}

                {showComposerTitle && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--blog-divider)', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {/* Category selection */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--blog-text-secondary)' }}>Danh mục:</span>
                        <select
                          value={composerCategory}
                          onChange={e => setComposerCategory(e.target.value)}
                          style={{
                            background: 'var(--blog-input-bg)',
                            color: 'var(--blog-text-primary)',
                            border: '1px solid var(--blog-divider)',
                            borderRadius: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {CATEGORIES.filter(c => c.key).map(c => (
                            <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Image Upload Input */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--blog-input-bg)', border: '1px solid var(--blog-divider)', color: 'var(--blog-text-primary)', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}>
                        📸 <span>Ảnh</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleComposerImageChange}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                      <button
                        onClick={() => {
                          setShowComposerTitle(false);
                          setComposerText('');
                          setComposerTitle('');
                          setComposerPreviewUrl('');
                          setComposerImageFile(null);
                        }}
                        style={{
                          padding: '0.45rem 1rem', borderRadius: '2rem', border: '1px solid var(--blog-divider)',
                          background: 'transparent', color: 'var(--blog-text-secondary)',
                          fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
                        }}
                      >
                        Hủy
                      </button>
                      <button
                        className="blog-composer-submit"
                        onClick={handleQuickPost}
                        disabled={composing || !composerText.trim()}
                        style={{ padding: '0.45rem 1.25rem', borderRadius: '2rem', border: 'none', background: 'var(--blog-accent)', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                      >
                        {composing ? (composerUploadStatus || 'Đang đăng...') : 'Đăng bài'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Posts Feed */}
              {loading ? (
                <div className="blog-loading">
                  <div className="blog-spinner"></div>
                </div>
              ) : posts.length === 0 ? (
                <div className="blog-empty">
                  <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📝</div>
                  <p>Chưa có bài viết nào. Hãy là người đầu tiên chia sẻ!</p>
                  <Link href="/blog/create" className="blog-empty-btn">
                    ✍️ Tạo bài viết
                  </Link>
                </div>
              ) : (
                <div>
                  {posts.map((post) => (
                    <ThreadCard key={post.id} post={post} onVoteUpdate={fetchPosts} />
                  ))}
                </div>
              )}
            </div>

            {/* ═══════ RIGHT SIDEBAR ═══════ */}
            <aside style={{ display: 'none', position: 'sticky', top: '64px', height: 'fit-content', padding: '1rem 0 1rem 0.5rem' }}
              className="blog-right-sidebar"
            >
              {/* Quick Links Card */}
              <div className="blog-sidebar" style={{ marginBottom: '1rem' }}>
                <h3 className="blog-sidebar-title" style={{ fontSize: '0.94rem', fontWeight: 800, paddingBottom: '0.5rem', borderBottom: '1px solid var(--blog-divider)' }}>
                  🚀 Liên kết nhanh
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <Link href="/safety" style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.6rem 0.85rem', borderRadius: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)',
                    color: '#ef4444', fontSize: '0.85rem', fontWeight: 600,
                    textDecoration: 'none', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)'}
                  >
                    <span>🛡️</span>
                    <span>Bản đồ cảnh báo an toàn</span>
                  </Link>
                  <Link href="/events" style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.6rem 0.85rem', borderRadius: '0.75rem',
                    background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.15)',
                    color: '#a78bfa', fontSize: '0.85rem', fontWeight: 600,
                    textDecoration: 'none', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.06)'}
                  >
                    <span>📅</span>
                    <span>Lịch sự kiện đầy đủ</span>
                  </Link>
                  <Link href="/recommend" style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.6rem 0.85rem', borderRadius: '0.75rem',
                    background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa', fontSize: '0.85rem', fontWeight: 600,
                    textDecoration: 'none', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)'}
                  >
                    <span>💡</span>
                    <span>Góp ý & Phản hồi</span>
                  </Link>
                  <Link href="/shorts" style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                    padding: '0.6rem 0.85rem', borderRadius: '0.75rem',
                    background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.15)',
                    color: '#34d399', fontSize: '0.85rem', fontWeight: 600,
                    textDecoration: 'none', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.06)'}
                  >
                    <span>🎬</span>
                    <span>VibeZ Shorts Video</span>
                  </Link>
                </div>
              </div>

              {/* Trending Tags */}
              <div className="blog-sidebar">
                <h3 className="blog-sidebar-title">🔥 Xu hướng</h3>
                {trendingTags.length > 0 ? (
                  trendingTags.map((item, idx) => (
                    <Link key={idx} href={`/blog/tag/${item.tag}`} className="blog-sidebar-item">
                      <span className="blog-sidebar-item-label">Xu hướng #{idx + 1}</span>
                      <span className="blog-sidebar-item-tag">#{item.tag}</span>
                      <span className="blog-sidebar-item-count">{item.postCount} bài viết</span>
                    </Link>
                  ))
                ) : (
                  <>
                    {[
                      { tag: 'reviewmonhoc', count: '142 bài viết' },
                      { tag: 'giarebinhthanh', count: '98 bài viết' },
                      { tag: 'timphongtro', count: '76 bài viết' },
                      { tag: 'tansinhvien', count: '55 bài viết' },
                    ].map((item, idx) => (
                      <Link key={idx} href={`/blog/tag/${item.tag}`} className="blog-sidebar-item">
                        <span className="blog-sidebar-item-label">Xu hướng #{idx + 1}</span>
                        <span className="blog-sidebar-item-tag">#{item.tag}</span>
                        <span className="blog-sidebar-item-count">{item.count}</span>
                      </Link>
                    ))}
                  </>
                )}
                <Link href="/blog" className="blog-sidebar-more">Xem thêm</Link>
              </div>
            </aside>

          </div>
        </main>

        {/* Responsive sidebar visibility via inline style + media query */}
        <style jsx global>{`
          @media (min-width: 1024px) {
            .blog-left-sidebar { display: block !important; }
            .blog-right-sidebar { display: block !important; }
          }
          @media (max-width: 1023px) {
            .blog-left-sidebar,
            .blog-right-sidebar { display: none !important; }
            main > div {
              grid-template-columns: minmax(0, 600px) !important;
              justify-content: center !important;
            }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
