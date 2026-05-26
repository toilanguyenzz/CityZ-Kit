'use client';

import '@/app/styles/blog.css';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import ThreadCard from '@/components/ThreadCard';
import { getPosts } from '@/lib/firestore';
import toast from 'react-hot-toast';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

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
  const [userData, setUserData] = useState(null);
  const [featuredLocations, setFeaturedLocations] = useState([]);
  const [sortBy, setSortBy] = useState('hot');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [user, setUser] = useState(null);

  // Auth listener for user state
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

  // Fetch featured locations for sidebar
  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const q = query(
          collection(db, 'locations'),
          orderBy('averageRating', 'desc'),
          limit(2)
        );
        const snapshot = await getDocs(q);
        setFeaturedLocations(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Error fetching featured locations:', error);
      }
    };
    fetchFeatured();
  }, []);

  // Fetch posts when sort/category changes
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

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* ═══════ LEFT SIDEBAR ═══════ */}
            <aside className="lg:col-span-3 hidden lg:flex flex-col gap-6 sticky top-20">
              {/* User Profile Card */}
              {userData ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 transition hover:shadow-md">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl mb-3 shadow-inner">
                      {userData.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{userData.name}</h3>
                    <p className="text-xs text-gray-500 font-medium mb-3">
                      {userData.role === 'admin' ? '🛡️ Quản trị viên' : '🎓 Sinh viên'}
                    </p>

                    {/* Badges */}
                    {userData.badges && userData.badges.length > 0 ? (
                      <div className="flex flex-wrap justify-center gap-1.5 mt-2 pt-3 border-t border-gray-100 w-full">
                        {userData.badges.map((badge, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-blue-100 shadow-sm"
                            title={badge.name}
                          >
                            <span>{badge.icon}</span>
                            {badge.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-2 italic pt-2 border-t border-gray-100 w-full">Chưa có huy hiệu</p>
                    )}

                    <Link
                      href="/profile"
                      className="mt-4 w-full text-center text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 py-2.5 rounded-xl transition-all"
                    >
                      Xem chi tiết hồ sơ
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center animate-pulse">
                  <div className="w-16 h-16 rounded-full bg-gray-200 mx-auto mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
                </div>
              )}

              {/* Trending Tags */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 transition hover:shadow-md">
                <h4 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                  <span>🏷️</span> Xu hướng tìm kiếm
                </h4>
                <div className="flex flex-col gap-3">
                  {[
                    { tag: 'reviewmonhoc', label: '#ReviewMonHoc', count: '142 bài viết' },
                    { tag: 'giarebinhthanh', label: '#GiaReBinhThanh', count: '98 bài viết' },
                    { tag: 'timphongtro', label: '#TimPhongTro', count: '76 bài viết' },
                    { tag: 'tansinhvien', label: '#TanSinhVien', count: '55 bài viết' },
                  ].map((item, idx) => (
                    <Link
                      key={idx}
                      href={`/blog/tag/${item.tag}`}
                      className="flex flex-col group py-1.5 border-b border-gray-50 last:border-0"
                    >
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-gray-400">{item.count}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>

            {/* ═══════ CENTER COLUMN: FEED ═══════ */}
            <div className="lg:col-span-6 flex flex-col gap-6 w-full">

              {/* Featured Post */}
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

              {/* Quick Post */}
              <div className="blog-quick-post">
                <div className="blog-quick-avatar">{userInitial}</div>
                <Link href="/blog/create" className="blog-quick-input">
                  Xin chào {userName}, chia sẻ gì đó nào...
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

              {/* Posts List */}
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
            </div>

            {/* ═══════ RIGHT SIDEBAR ═══════ */}
            <aside className="lg:col-span-3 hidden lg:flex flex-col gap-6 sticky top-20">
              {/* AI Gemini Mini Form */}
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-2xl shadow-sm p-5 relative overflow-hidden group transition hover:shadow-md">
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>

                <h4 className="font-bold text-sm mb-2 flex items-center gap-2 relative z-10">
                  <span>🤖</span> Trợ lý AI Gemini
                </h4>
                <p className="text-xs text-blue-100 leading-relaxed mb-4 relative z-10">
                  Bạn cần tìm quán ăn ngon, nhà trọ giá rẻ hay quán cafe học bài? Nhập nhanh yêu cầu để nhận gợi ý tức thì!
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = e.target.query.value;
                    if (q.trim()) {
                      window.location.href = `/recommend?q=${encodeURIComponent(q)}`;
                    }
                  }}
                  className="flex gap-2 relative z-10"
                >
                  <input
                    type="text"
                    name="query"
                    placeholder="Bạn muốn hỏi gì..."
                    className="flex-1 bg-white/15 hover:bg-white/20 focus:bg-white text-white focus:text-gray-900 placeholder-blue-100 focus:placeholder-gray-400 text-xs rounded-xl px-3 py-2 border border-white/10 focus:border-white focus:outline-none transition-all"
                  />
                  <button
                    type="submit"
                    className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-3 py-2 rounded-xl transition text-xs flex items-center justify-center shrink-0 shadow-sm"
                    title="Gửi câu hỏi"
                  >
                    ⚡
                  </button>
                </form>
              </div>

              {/* Featured Student Spots */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 transition hover:shadow-md">
                <h4 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                  <span>📍</span> Điểm đến đề xuất
                </h4>

                {featuredLocations.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {featuredLocations.map((loc) => (
                      <Link
                        key={loc.id}
                        href={`/location/${loc.id}`}
                        className="flex gap-3 group border-b border-gray-50 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                          {loc.imageUrl ? (
                            <img src={loc.imageUrl} alt={loc.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-500 font-bold">📍</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-xs text-gray-800 leading-snug truncate group-hover:text-blue-600 transition">
                            {loc.name}
                          </h5>
                          <p className="text-[10px] text-gray-500 truncate mb-1">📍 {loc.address}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-yellow-500 flex items-center gap-0.5">
                              ⭐ {loc.averageRating ? Number(loc.averageRating).toFixed(1) : '0.0'}
                            </span>
                            <span className="text-[9px] text-gray-400">({loc.reviewCount || 0} đánh giá)</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic text-center py-4">Chưa có địa điểm nổi bật</p>
                )}

                <Link
                  href="/dashboard"
                  className="block text-center text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 py-2.5 rounded-xl mt-4 transition"
                >
                  Khám phá thêm địa điểm →
                </Link>
              </div>

              {/* Active Members */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 transition hover:shadow-md">
                <h4 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                  <span>🏆</span> Đóng góp nhiều nhất
                </h4>
                <div className="flex flex-col gap-3">
                  {[
                    { name: 'Nguyen Ta', role: 'Đại sứ sinh viên', points: '120 đóng góp', badge: '👑' },
                    { name: 'Minh Tran', role: 'Cộng tác viên', points: '95 đóng góp', badge: '🥈' },
                  ].map((member, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 py-1">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center font-bold text-xs text-blue-600 shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <h5 className="font-bold text-xs text-gray-800 truncate">{member.name}</h5>
                          <span className="text-xs shrink-0">{member.badge}</span>
                        </div>
                        <p className="text-[9px] text-gray-400">{member.role} · {member.points}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
