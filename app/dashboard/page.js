'use client';

import '@/app/styles/dashboard.css';
import Navbar from '@/components/Navbar';
import LocationCard from '@/components/LocationCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth, onAuthStateChanged } from '@/lib/firebase';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const LocketCameraModal = dynamic(() => import('@/components/LocketCameraModal'), { ssr: false });

export default function Dashboard() {
  const [locations, setLocations] = useState([]);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [ratingFilter, setRatingFilter] = useState('All');
  const [videoFilter, setVideoFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [showCameraModal, setShowCameraModal] = useState(false);

  const storiesRef = useRef(null);

  const locketCheckIns = useMemo(() => {
    return locations
      .filter(l => l.imageUrl && !l.videoUrl && (l.status === 'approved' || !l.status))
      .slice(0, 20);
  }, [locations]);

  const categories = [
    { key: 'All', label: 'Tất cả', emoji: '🌐' },
    { key: 'Food', label: 'Ăn uống', emoji: '🍜' },
    { key: 'Housing', label: 'Nhà trọ', emoji: '🏠' },
    { key: 'Cafe', label: 'Cafe', emoji: '☕' },
    { key: 'Play', label: 'Vui chơi', emoji: '🎡' },
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

  const extractDistrict = (address) => {
    if (!address) return '';
    const addrLower = address.toLowerCase();
    
    const districts = [
      { name: 'Quận 1', keywords: ['quận 1', 'quan 1', 'q1', 'q.1', 'district 1'] },
      { name: 'Quận 2', keywords: ['quận 2', 'quan 2', 'q2', 'q.2', 'district 2'] },
      { name: 'Quận 3', keywords: ['quận 3', 'quan 3', 'q3', 'q.3', 'district 3'] },
      { name: 'Quận 4', keywords: ['quận 4', 'quan 4', 'q4', 'q.4', 'district 4'] },
      { name: 'Quận 5', keywords: ['quận 5', 'quan 5', 'q5', 'q.5', 'district 5'] },
      { name: 'Quận 6', keywords: ['quận 6', 'quan 6', 'q6', 'q.6', 'district 6'] },
      { name: 'Quận 7', keywords: ['quận 7', 'quan 7', 'q7', 'q.7', 'district 7'] },
      { name: 'Quận 8', keywords: ['quận 8', 'quan 8', 'q8', 'q.8', 'district 8'] },
      { name: 'Quận 9', keywords: ['quận 9', 'quan 9', 'q9', 'q.9', 'district 9'] },
      { name: 'Quận 10', keywords: ['quận 10', 'quan 10', 'q10', 'q.10', 'district 10'] },
      { name: 'Quận 11', keywords: ['quận 11', 'quan 11', 'q11', 'q.11', 'district 11'] },
      { name: 'Quận 12', keywords: ['quận 12', 'quan 12', 'q12', 'q.12', 'district 12'] },
      { name: 'Bình Thạnh', keywords: ['bình thạnh', 'binh thanh', 'b.thạnh', 'b thạnh', 'binhthanh'] },
      { name: 'Gò Vấp', keywords: ['gò vấp', 'go vap', 'g.vấp', 'g vấp', 'govap'] },
      { name: 'Phú Nhuận', keywords: ['phú nhuận', 'phu nhuan', 'p.nhuận', 'p nhuận', 'phunhuan'] },
      { name: 'Tân Bình', keywords: ['tân bình', 'tan binh', 't.bình', 't bình', 'tanbinh'] },
      { name: 'Tân Phú', keywords: ['tân phú', 'tan phu', 't.phú', 't phú', 'tanphu'] },
      { name: 'Bình Tân', keywords: ['bình tân', 'binh tan', 'binhtan'] },
      { name: 'Thủ Đức', keywords: ['thủ đức', 'thu duc', 't.đức', 't đức', 'thuduc'] },
      { name: 'Nhà Bè', keywords: ['nhà bè', 'nha be', 'nhabe'] },
      { name: 'Hóc Môn', keywords: ['hóc môn', 'hoc mon', 'hocmon'] },
      { name: 'Củ Chi', keywords: ['củ chi', 'cu chi', 'cuchi'] },
      { name: 'Bình Chánh', keywords: ['bình chánh', 'binh chanh', 'binhchanh'] },
      { name: 'Cần Giờ', keywords: ['cần giờ', 'can gio', 'cangio'] }
    ];

    for (const d of districts) {
      for (const kw of d.keywords) {
        if (addrLower.includes(kw)) {
          return d.name;
        }
      }
    }
    return '';
  };

  // Filter + Search + Sort
  const processedLocations = useMemo(() => {
    let result = locations.filter(loc => loc.status === 'approved' || !loc.status);

    if (filter !== 'All') {
      result = result.filter(loc => loc.category === filter);
    }

    if (districtFilter !== 'All') {
      result = result.filter(loc => {
        if (loc.district) {
          return loc.district.toLowerCase() === districtFilter.toLowerCase();
        }
        const ext = extractDistrict(loc.address);
        return ext.toLowerCase() === districtFilter.toLowerCase();
      });
    }

    if (ratingFilter !== 'All') {
      const minRating = parseFloat(ratingFilter);
      result = result.filter(loc => {
        const avg = parseFloat(getAverageRating(loc.reviews)) || 0;
        return avg >= minRating;
      });
    }

    if (videoFilter === 'video') {
      result = result.filter(loc => loc.videoUrl);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(loc =>
        (loc.name || '').toLowerCase().includes(q) ||
        (loc.address || '').toLowerCase().includes(q) ||
        (loc.description || '').toLowerCase().includes(q)
      );
    }

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
  }, [locations, filter, searchQuery, sortBy, districtFilter, ratingFilter, videoFilter]);

  const firstName = userData?.name?.split(' ').pop() || 'Bạn';

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="db-spinner"></div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50/80">
        <Navbar />

        {/* ═══ Section 1: Locket Stories Strip (Instagram-style) ═══ */}
        <div className="bg-white border-b border-gray-100 db-fade-in">
          <div className="max-w-6xl mx-auto px-4 py-3">
            {/* Strip header */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">⚡ Check-in</span>
                <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full tracking-wide">
                  Live
                </span>
              </div>
              <Link
                href="/shorts"
                className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                Xem Shorts →
              </Link>
            </div>

            {/* Horizontal stories scroll */}
            <div ref={storiesRef} className="stories-strip flex gap-3 overflow-x-auto pb-1">
              {/* Add Story (Camera) button */}
              <button
                onClick={() => setShowCameraModal(true)}
                className="flex flex-col items-center gap-1 flex-shrink-0 group"
              >
                <div className="relative w-16 h-16 rounded-full border-2 border-dashed border-indigo-300 bg-indigo-50 flex items-center justify-center group-hover:border-indigo-500 group-hover:bg-indigo-100 transition-all duration-200 story-add-ring">
                  <span className="text-xl">📸</span>
                </div>
                <span className="text-[10px] font-semibold text-gray-500 group-hover:text-indigo-600 transition-colors">
                  Chụp ngay
                </span>
              </button>

              {/* Story items */}
              {locketCheckIns.length === 0 ? (
                <div className="flex items-center text-gray-400 text-xs italic px-4">
                  Chưa có check-in nào. Hãy là người đầu tiên! 🎉
                </div>
              ) : (
                locketCheckIns.map((loc) => {
                  const avatar = loc.createdByAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(loc.createdByName || 'U')}&background=6366f1&color=fff&size=64`;
                  return (
                    <Link
                      key={loc.id}
                      href={`/shorts?activeId=${loc.id}`}
                      className="flex flex-col items-center gap-1 flex-shrink-0 group"
                    >
                      {/* Avatar ring with image preview */}
                      <div className="relative w-16 h-16 rounded-full p-0.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 group-hover:scale-105 transition-transform duration-200">
                        <div className="w-full h-full rounded-full overflow-hidden border-2 border-white">
                          <img
                            src={loc.imageUrl}
                            alt={loc.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {/* Tiny avatar badge */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white overflow-hidden bg-white shadow-sm">
                          <img src={avatar} alt="" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-gray-600 max-w-[64px] truncate text-center group-hover:text-indigo-600 transition-colors">
                        {loc.name}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ═══ Section 2: Sticky Search + Filters ═══ */}
        <div className="db-sticky-toolbar bg-white/95 border-b border-gray-100/80 db-fade-in db-fade-in-1">
          <div className="max-w-6xl mx-auto px-4 py-3">
            {/* Row 1: Search */}
            <div className="mb-2.5">
              <div className="relative w-full">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
                  placeholder="Tìm quán ăn, cafe, nhà trọ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: Advanced Dropdowns Scroll Strip */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-2.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
              {/* District Filter */}
              <select
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-semibold text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all appearance-none flex-shrink-0"
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 8px center', backgroundRepeat: 'no-repeat', backgroundSize: '12px', paddingRight: '26px' }}
              >
                <option value="All">📍 Tất cả quận</option>
                <option value="Quận 1">Quận 1</option>
                <option value="Quận 2">Quận 2</option>
                <option value="Quận 3">Quận 3</option>
                <option value="Quận 4">Quận 4</option>
                <option value="Quận 5">Quận 5</option>
                <option value="Quận 6">Quận 6</option>
                <option value="Quận 7">Quận 7</option>
                <option value="Quận 8">Quận 8</option>
                <option value="Quận 9">Quận 9</option>
                <option value="Quận 10">Quận 10</option>
                <option value="Quận 11">Quận 11</option>
                <option value="Quận 12">Quận 12</option>
                <option value="Bình Thạnh">Bình Thạnh</option>
                <option value="Gò Vấp">Gò Vấp</option>
                <option value="Phú Nhuận">Phú Nhuận</option>
                <option value="Tân Bình">Tân Bình</option>
                <option value="Tân Phú">Tân Phú</option>
                <option value="Bình Tân">Bình Tân</option>
                <option value="Thủ Đức">Thủ Đức</option>
                <option value="Bình Chánh">Bình Chánh</option>
                <option value="Hóc Môn">Hóc Môn</option>
                <option value="Củ Chi">Củ Chi</option>
                <option value="Nhà Bè">Nhà Bè</option>
                <option value="Cần Giờ">Cần Giờ</option>
              </select>

              {/* Rating Filter */}
              <select
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-semibold text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all appearance-none flex-shrink-0"
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 8px center', backgroundRepeat: 'no-repeat', backgroundSize: '12px', paddingRight: '26px' }}
              >
                <option value="All">⭐ Tất cả sao</option>
                <option value="4.5">⭐ từ 4.5 ★ trở lên</option>
                <option value="4.0">⭐ từ 4.0 ★ trở lên</option>
                <option value="3.0">⭐ từ 3.0 ★ trở lên</option>
              </select>

              {/* Video Filter */}
              <select
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-semibold text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all appearance-none flex-shrink-0"
                value={videoFilter}
                onChange={(e) => setVideoFilter(e.target.value)}
                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 8px center', backgroundRepeat: 'no-repeat', backgroundSize: '12px', paddingRight: '26px' }}
              >
                <option value="All">🎞️ Tất cả bài</option>
                <option value="video">🎬 Có video ngắn</option>
              </select>

              {/* Sort dropdown */}
              <select
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-semibold text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all appearance-none flex-shrink-0"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 8px center', backgroundRepeat: 'no-repeat', backgroundSize: '12px', paddingRight: '26px' }}
              >
                <option value="newest">🕐 Mới nhất</option>
                <option value="rating">⭐ Rating cao</option>
                <option value="reviews">💬 Nhiều review</option>
              </select>
            </div>

            {/* Row 2: Category filters — horizontal scroll */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
              {categories.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setFilter(cat.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                    filter === cat.key
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  <span className="text-sm">{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ Section 3: Main Content ═══ */}
        <main className="max-w-6xl mx-auto px-4 pt-5 pb-24">
          {/* AI Tip — compact inline banner */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl px-4 py-2.5 mb-5 db-fade-in db-fade-in-2">
            <span className="text-lg flex-shrink-0">🤖</span>
            <p className="text-xs text-gray-600 flex-1">
              <span className="font-semibold text-indigo-700">AI gợi ý</span> — Nhập ngân sách, khẩu vị để được gợi ý địa điểm phù hợp
            </p>
            <Link
              href="/recommend"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 whitespace-nowrap transition-colors"
            >
              Thử ngay ✨
            </Link>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400 font-medium">
              {processedLocations.length} địa điểm
              {searchQuery.trim() && <> cho &ldquo;{searchQuery}&rdquo;</>}
            </p>
            {/* Greeting chip */}
            <p className="text-xs text-gray-400">
              Chào <span className="font-semibold text-gray-600">{firstName}</span> 👋
            </p>
          </div>

          {/* ═══ Location Grid ═══ */}
          {processedLocations.length === 0 ? (
            <div className="text-center py-16 db-fade-in">
              <div className="text-5xl mb-4">
                {searchQuery.trim() ? '🔍' : '📍'}
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-1">
                {searchQuery.trim()
                  ? 'Không tìm thấy kết quả'
                  : 'Chưa có địa điểm nào'}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {searchQuery.trim()
                  ? 'Thử thay đổi từ khóa hoặc bộ lọc'
                  : 'Hãy là người đầu tiên thêm địa điểm!'}
              </p>
              {!searchQuery.trim() && (
                <Link
                  href="/add-location"
                  className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  <span>➕</span> Thêm địa điểm
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 db-fade-in db-fade-in-3">
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

        {/* Locket Camera Modal */}
        {showCameraModal && (
          <LocketCameraModal
            onClose={() => setShowCameraModal(false)}
            onUploadSuccess={fetchLocations}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
