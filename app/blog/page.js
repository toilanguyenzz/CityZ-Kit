'use client';

import '@/app/styles/blog.css';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth, onAuthStateChanged } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import ThreadCard from '@/components/ThreadCard';
import { getPosts } from '@/lib/firestore';
import toast from 'react-hot-toast';

const SORT_OPTIONS = [
  { key: 'hot', label: '🔥 Hot', desc: 'Trending' },
  { key: 'new', label: '🕐 Mới nhất', desc: 'Recent' },
  { key: 'top', label: '⬆️ Top', desc: 'Most upvoted' },
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
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('hot');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [sortBy, categoryFilter]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await getPosts(sortBy, categoryFilter);
      setPosts(data);
    } catch (error) {
      toast.error('Không thể tải bài viết');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const userInitial = user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Bạn';

  // Find featured post (most upvoted or pinned, with image preferred)
  const featuredPost = posts.find(p => p.isPinned && p.imageUrl) 
    || posts.find(p => p.isPinned) 
    || posts.find(p => p.imageUrl && (p.upvotes || 0) > 0)
    || (posts.length > 0 && posts[0].imageUrl ? posts[0] : null);

  return (
    <ProtectedRoute>
      <div className="blog-root">
        <Navbar />

        {/* ───── Hero Banner ───── */}
        <div className="blog-hero">
          <div className="blog-hero-bg"></div>
          <div className="blog-hero-content">
            <div className="blog-hero-badge">💬 Cộng đồng sinh viên</div>
            <h1 className="blog-hero-title">
              Diễn đàn <span>CityZ</span>
            </h1>
            <p className="blog-hero-desc">
              Nơi sinh viên chia sẻ kinh nghiệm, hỏi đáp và kết nối — từ review quán ăn đến tips thuê nhà trọ.
            </p>
            <div className="blog-hero-stats">
              <div className="blog-hero-stat">
                <span className="blog-hero-stat-num">{posts.length}</span>
                <span className="blog-hero-stat-label">Bài viết</span>
              </div>
              <div className="blog-hero-stat">
                <span className="blog-hero-stat-num">{posts.reduce((s, p) => s + (p.commentCount || 0), 0)}</span>
                <span className="blog-hero-stat-label">Bình luận</span>
              </div>
              <div className="blog-hero-stat">
                <span className="blog-hero-stat-num">{posts.reduce((s, p) => s + (p.upvotes || 0), 0)}</span>
                <span className="blog-hero-stat-label">Upvotes</span>
              </div>
            </div>
          </div>
        </div>

        <main className="blog-main">
          {/* ───── Featured Post ───── */}
          {featuredPost && (
            <Link href={`/post/${featuredPost.id}`} className="blog-featured">
              <div className="blog-featured-image">
                {featuredPost.imageUrl ? (
                  <img src={featuredPost.imageUrl} alt={featuredPost.title} />
                ) : (
                  <div className="blog-featured-placeholder">
                    <span>📝</span>
                  </div>
                )}
                <div className="blog-featured-overlay">
                  <span className="blog-featured-badge">⭐ Nổi bật</span>
                </div>
              </div>
              <div className="blog-featured-info">
                <h2 className="blog-featured-title">{featuredPost.title}</h2>
                <p className="blog-featured-preview">
                  {featuredPost.content?.substring(0, 120)}{featuredPost.content?.length > 120 ? '...' : ''}
                </p>
                <div className="blog-featured-meta">
                  <span>✍️ {featuredPost.authorName?.includes('@') ? featuredPost.authorName.split('@')[0] : featuredPost.authorName || 'Ẩn danh'}</span>
                  {(featuredPost.upvotes || 0) > 0 && <span>⬆️ {featuredPost.upvotes} upvotes</span>}
                  {(featuredPost.commentCount || 0) > 0 && <span>💬 {featuredPost.commentCount}</span>}
                </div>
              </div>
            </Link>
          )}

          {/* ───── Quick Post ───── */}
          <div className="blog-quick-post">
            <div className="blog-quick-avatar">{userInitial}</div>
            <Link href="/blog/create" className="blog-quick-input">
              Xin chào {userName}, chia sẻ gì đó nào...
            </Link>
          </div>

          {/* ───── Sort Tabs ───── */}
          <div className="blog-sort-tabs">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`blog-sort-btn ${sortBy === opt.key ? 'active' : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* ───── Category Filters ───── */}
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

          {/* ───── Posts ───── */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
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
        </main>
      </div>
    </ProtectedRoute>
  );
}
