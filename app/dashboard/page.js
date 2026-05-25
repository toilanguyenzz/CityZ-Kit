'use client';

import '@/app/styles/dashboard.css';
import Navbar from '@/components/Navbar';
import LocationCard from '@/components/LocationCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth, onAuthStateChanged } from '@/lib/firebase';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [locations, setLocations] = useState([]);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  const categories = [
    { key: 'All', label: 'Tất cả', emoji: '🌐' },
    { key: 'Food', label: 'Ăn uống', emoji: '🍜' },
    { key: 'Housing', label: 'Nhà trọ', emoji: '🏠' },
    { key: 'Cafe', label: 'Cafe', emoji: '☕' },
    { key: 'Other', label: 'Khác', emoji: '🏷️' },
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else {
            setUserData({ name: user.displayName || user.email, badges: [] });
          }
        } catch (e) {
          setUserData({ name: user.displayName || user.email, badges: [] });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const q = query(collection(db, 'locations'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt),
      }));
      setLocations(data);
    } catch (error) {
      toast.error('Không thể tải địa điểm');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getAverageRating = (reviews = []) => {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  // Stats
  const totalLocations = locations.length;
  const verifiedCount = locations.filter(l => (l.reviewCount || 0) >= 3).length;
  const topRating = locations.length > 0
    ? Math.max(...locations.map(l => l.averageRating || 0)).toFixed(1)
    : '0.0';

  // Featured = highest rated with at least 1 review
  const featured = useMemo(() => {
    const rated = locations.filter(l => (l.averageRating || 0) > 0);
    if (!rated.length) return null;
    return rated.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))[0];
  }, [locations]);

  // Filter + Search + Sort
  const processedLocations = useMemo(() => {
    // Only show approved locations
    let result = locations.filter(loc => loc.status === 'approved' || !loc.status);

    // Category filter
    if (filter !== 'All') {
      result = result.filter(loc => loc.category === filter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(loc =>
        (loc.name || '').toLowerCase().includes(q) ||
        (loc.address || '').toLowerCase().includes(q) ||
        (loc.description || '').toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case 'rating':
        result.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        break;
      case 'reviews':
        result.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    return result;
  }, [locations, filter, searchQuery, sortBy]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="dashboard-root">
          <Navbar />
          <div className="db-loading">
            <div className="db-spinner"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const firstName = userData?.name?.split(' ').pop() || 'Bạn';

  return (
    <ProtectedRoute>
      <div className="dashboard-root">
        <Navbar />

        {/* ───── Hero Banner ───── */}
        <section className="db-hero">
          <div className="db-hero-inner">
            <div>
              <h1 className="db-hero-greeting">
                Xin chào, <span>{firstName}</span> 👋
              </h1>
              <p className="db-hero-subtitle">
                Khám phá những địa điểm tốt nhất dành cho sinh viên TP.HCM
              </p>
              {userData?.badges?.length > 0 && (
                <div className="db-hero-badges">
                  {userData.badges.map((badge, i) => (
                    <span key={i} className="db-badge-tag">
                      <span className="badge-icon">{badge.icon}</span>
                      {badge.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="db-stats-row">
              <div className="db-stat-card">
                <div className="db-stat-number">{totalLocations}</div>
                <div className="db-stat-label">Địa điểm</div>
              </div>
              <div className="db-stat-card">
                <div className="db-stat-number">{verifiedCount}</div>
                <div className="db-stat-label">Verified</div>
              </div>
              <div className="db-stat-card">
                <div className="db-stat-number">⭐ {topRating}</div>
                <div className="db-stat-label">Top Rating</div>
              </div>
            </div>
          </div>
        </section>

        <main className="db-main">
          {/* ───── AI Spotlight ───── */}
          <div className="db-ai-spotlight" style={{ marginBottom: '2rem' }}>
            <div className="db-ai-info">
              <div className="db-ai-title">
                <span>🤖</span> Trợ lý AI thông minh
              </div>
              <p className="db-ai-desc">
                Nhập ngân sách, khẩu vị, khu vực — AI gợi ý 3 địa điểm phù hợp nhất cho bạn!
              </p>
            </div>
            <Link href="/recommend" className="db-ai-btn">
              ✨ Hỏi AI ngay
            </Link>
          </div>

          {/* ───── Toolbar: Search + Sort ───── */}
          <div className="db-toolbar">
            <div className="db-search-wrap">
              <span className="db-search-icon">🔍</span>
              <input
                type="text"
                className="db-search-input"
                placeholder="Tìm kiếm theo tên, địa chỉ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="db-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">🕐 Mới nhất</option>
              <option value="rating">⭐ Rating cao nhất</option>
              <option value="reviews">💬 Nhiều đánh giá nhất</option>
            </select>
          </div>

          {/* ───── Category Filters ───── */}
          <div className="db-filters">
            {categories.map(cat => (
              <button
                key={cat.key}
                onClick={() => setFilter(cat.key)}
                className={`db-filter-btn ${filter === cat.key ? 'active' : ''}`}
              >
                <span className="db-filter-emoji">{cat.emoji}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* ───── Featured Location ───── */}
          {featured && filter === 'All' && !searchQuery.trim() && (
            <div className="db-featured">
              <div className="db-featured-label">
                <span>🏆</span> Địa điểm nổi bật
              </div>
              <div className="db-featured-card">
                <div className="db-featured-img">
                  {featured.imageUrl ? (
                    <img src={featured.imageUrl} alt={featured.name} />
                  ) : (
                    <div className="db-featured-img-placeholder">📍</div>
                  )}
                </div>
                <div className="db-featured-body">
                  <span className="db-featured-cat">
                    {categories.find(c => c.key === featured.category)?.emoji}{' '}
                    {categories.find(c => c.key === featured.category)?.label || featured.category}
                  </span>
                  <h3 className="db-featured-name">{featured.name}</h3>
                  <p className="db-featured-desc">{featured.description}</p>
                  <p className="db-featured-addr">📍 {featured.address}</p>
                  <div className="db-featured-footer">
                    <span className="db-featured-rating">
                      ⭐ {(featured.averageRating || 0).toFixed(1)}
                    </span>
                    <span className="db-featured-reviews">
                      ({featured.reviewCount || 0} đánh giá)
                    </span>
                    <Link href={`/location/${featured.id}`} className="db-featured-link">
                      Xem chi tiết →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ───── Results Count ───── */}
          <p className="db-results-count">
            Hiển thị {processedLocations.length} / {locations.length} địa điểm
            {searchQuery.trim() && <> cho &ldquo;{searchQuery}&rdquo;</>}
          </p>

          {/* ───── Locations Grid ───── */}
          {processedLocations.length === 0 ? (
            <div className="db-empty">
              <div className="db-empty-icon">
                {searchQuery.trim() ? '🔍' : '📍'}
              </div>
              <h3 className="db-empty-title">
                {searchQuery.trim()
                  ? 'Không tìm thấy kết quả'
                  : 'Chưa có địa điểm nào'}
              </h3>
              <p className="db-empty-desc">
                {searchQuery.trim()
                  ? 'Thử thay đổi từ khóa hoặc bộ lọc khác'
                  : 'Hãy là người đầu tiên thêm địa điểm cho cộng đồng!'}
              </p>
              {!searchQuery.trim() && (
                <Link href="/add-location" className="db-empty-btn">
                  <span>➕</span> Thêm địa điểm
                </Link>
              )}
            </div>
          ) : (
            <div className="db-grid">
              {processedLocations.map(location => (
                <LocationCard
                  key={location.id}
                  location={location}
                  averageRating={getAverageRating(location.reviews)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
