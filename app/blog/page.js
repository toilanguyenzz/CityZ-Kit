'use client';

import '@/app/styles/blog.css';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import ThreadCard from '@/components/ThreadCard';
import { getPosts, getTrendingTags, addPost } from '@/lib/firestore';
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

  // Fetch posts when tab/category changes
  useEffect(() => {
    fetchPosts();
  }, [activeTab, categoryFilter]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const sortBy = activeTab === 'new' ? 'new' : activeTab === 'trending' ? 'top' : 'hot';
      const data = await getPosts(sortBy, categoryFilter);
      setPosts(data);
    } catch (error) {
      toast.error('Không thể tải bài viết');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Inline compose submit
  const handleQuickPost = async () => {
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (!composerText.trim()) return;
    setComposing(true);
    try {
      const title = composerTitle.trim() || composerText.substring(0, 60);
      await addPost(
        user.uid,
        userData?.name || user.displayName || user.email,
        title,
        composerText,
        null,
        role,
        'discussion',
        'general',
        null,
        false,
        userData?.avatarUrl || null,
        userData?.badges || [],
        []
      );
      toast.success(isAdmin ? 'Đã đăng bài!' : 'Đã gửi! Bài viết đang chờ duyệt.');
      setComposerText('');
      setComposerTitle('');
      setShowComposerTitle(false);
      fetchPosts();
    } catch (err) {
      toast.error(err.message || 'Lỗi đăng bài');
    } finally {
      setComposing(false);
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

              {/* Category Filters */}
              <div className="blog-cat-filters">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.key || 'all'}
                    onClick={() => setCategoryFilter(cat.key)}
                    className={`blog-cat-btn ${categoryFilter === cat.key ? 'active' : ''}`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>

              {/* Inline Composer */}
              <div className="blog-composer">
                <div className="blog-composer-avatar">{userInitial}</div>
                <div className="blog-composer-body">
                  {showComposerTitle && (
                    <input
                      type="text"
                      value={composerTitle}
                      onChange={(e) => setComposerTitle(e.target.value)}
                      placeholder="Tiêu đề (tùy chọn)"
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        outline: 'none',
                        color: 'var(--blog-text-primary)',
                        fontSize: '1rem',
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        padding: '0.25rem 0',
                        marginBottom: '0.25rem',
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
                  {showComposerTitle && (
                    <div className="blog-composer-tools">
                      <div className="blog-composer-icons">
                        <Link href="/blog/create" className="blog-composer-icon-btn" title="Bài viết đầy đủ">📝</Link>
                        <button className="blog-composer-icon-btn" title="Thêm ảnh" onClick={() => router.push('/blog/create')}>📸</button>
                        <button className="blog-composer-icon-btn" title="Tạo khảo sát" onClick={() => router.push('/blog/create')}>📊</button>
                      </div>
                      <button
                        className="blog-composer-submit"
                        onClick={handleQuickPost}
                        disabled={composing || !composerText.trim()}
                      >
                        {composing ? 'Đang đăng...' : 'Đăng'}
                      </button>
                    </div>
                  )}
                </div>
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
              {/* AI Gemini Card */}
              <div style={{ marginBottom: '1rem' }}>
                <div className="blog-sidebar" style={{ background: 'linear-gradient(135deg, rgba(29,155,240,0.12), rgba(168,85,247,0.08))', border: '1px solid rgba(29,155,240,0.2)' }}>
                  <div style={{ padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--blog-text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      🤖 Trợ lý AI Gemini
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--blog-text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                      Tìm quán ăn, nhà trọ, cafe? Hỏi AI ngay!
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const q = e.target.query.value;
                        if (q.trim()) window.location.href = `/recommend?q=${encodeURIComponent(q)}`;
                      }}
                      style={{ display: 'flex', gap: '0.5rem' }}
                    >
                      <input
                        type="text"
                        name="query"
                        placeholder="Bạn muốn hỏi gì..."
                        style={{
                          flex: 1,
                          background: 'var(--blog-input-bg)',
                          border: '1px solid var(--blog-divider)',
                          borderRadius: '2rem',
                          padding: '0.5rem 0.85rem',
                          color: 'var(--blog-text-primary)',
                          fontSize: '0.82rem',
                          outline: 'none',
                          fontFamily: 'inherit',
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          background: 'var(--blog-accent)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '2.25rem',
                          height: '2.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          flexShrink: 0,
                        }}
                      >
                        ⚡
                      </button>
                    </form>
                  </div>
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
