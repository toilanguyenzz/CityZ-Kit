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

  return (
    <ProtectedRoute>
      <div className="blog-root">
        <Navbar />
        <main className="blog-main">
          {/* Quick Post */}
          <div className="blog-quick-post">
            <div className="blog-quick-avatar">{userInitial}</div>
            <Link href="/blog/create" className="blog-quick-input">
              Chia sẻ điều gì đó với cộng đồng...
            </Link>
          </div>

          {/* Sort Tabs */}
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

          {/* Posts */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="blog-empty">
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
