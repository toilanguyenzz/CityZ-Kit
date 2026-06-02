'use client';

import '@/app/styles/dashboard.css';
import Navbar from '@/components/Navbar';
import LocationCard from '@/components/LocationCard';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc, where } from 'firebase/firestore';
import { db, auth, onAuthStateChanged } from '@/lib/firebase';
import { getUserStats, calculateXPFromStats, getLevelFromXP, computeTasteDNA, updateUserProfile } from '@/lib/firestore';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const LocketCameraModal = dynamic(() => import('@/components/LocketCameraModal'), { ssr: false });
const ProductTour = dynamic(() => import('@/components/ProductTour'), { ssr: false });

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Chào buổi sáng', emoji: '🌅' };
  if (h < 18) return { text: 'Chào buổi chiều', emoji: '☀️' };
  return { text: 'Chào buổi tối', emoji: '🌙' };
}

const QUICK_ACTIONS = [
  { emoji: '🍜', label: 'Ăn gì?', filterKey: 'Food', href: null },
  { emoji: '🏠', label: 'Tìm trọ', filterKey: 'Housing', href: null },
  { emoji: '🤝', label: 'Tìm bạn', filterKey: null, href: '/buddy-finder' },
  { emoji: '🛡️', label: 'An toàn', filterKey: null, href: '/safety' },
  { emoji: '🛍️', label: 'Mua đồ', filterKey: null, href: '/marketplace' },
  { emoji: '📝', label: 'Cộng đồng', filterKey: null, href: '/blog' },
];

const UNIVERSITIES = [
  'Đại học Quốc gia TP.HCM',
  'Đại học Bách Khoa (HCMUT)',
  'Đại học Khoa học Tự nhiên (HCMUS)',
  'Đại học KHXH & Nhân văn (USSH)',
  'Đại học Công nghệ Thông tin (UIT)',
  'Đại học Kinh tế - Luật (UEL)',
  'Đại học Sư phạm Kỹ thuật (UTE)',
  'Đại học Ngoại thương (FTU2)',
  'Đại học Kinh tế TP.HCM (UEH)',
  'Đại học HUTECH',
  'Đại học FPT TP.HCM'
];

const DISTRICTS = [
  'Quận 1', 'Quận 2', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 
  'Quận 7', 'Quận 8', 'Quận 9', 'Quận 10', 'Quận 11', 'Quận 12', 
  'Bình Thạnh', 'Gò Vấp', 'Phú Nhuận', 'Tân Bình', 'Tân Phú', 'Bình Tân', 
  'Thủ Đức', 'Bình Chánh', 'Hóc Môn', 'Củ Chi', 'Nhà Bè', 'Cần Giờ'
];

const BUDGETS = [
  { val: 'under_2m', label: '< 2 triệu/tháng', emoji: '🪙' },
  { val: '2m_3.5m', label: '2 - 3.5 triệu/tháng', emoji: '💵' },
  { val: '3.5m_5m', label: '3.5 - 5 triệu/tháng', emoji: '💳' },
  { val: 'above_5m', label: '> 5 triệu/tháng', emoji: '🏰' }
];

const FOOD_PREFS = [
  { val: 'com_tam', label: 'Cơm tấm', emoji: '🍛' },
  { val: 'bun_bo', label: 'Bún bò / Phở', emoji: '🍲' },
  { val: 'com_binh_dan', label: 'Cơm bình dân / Cơm trưa', emoji: '🍱' },
  { val: 'an_vat', label: 'Ăn vặt / Đường phố', emoji: '🍢' },
  { val: 'cafe', label: 'Cà phê học bài', emoji: '☕' },
  { val: 'tra_sua', label: 'Trà sữa / Đồ uống', emoji: '🧋' },
  { val: 'han_nhat', label: 'Đồ Hàn / Đồ Nhật', emoji: '🍣' },
  { val: 'lau_nuong', label: 'Lẩu / Đồ nướng', emoji: '🍖' },
  { val: 'an_chay', label: 'Món chay', emoji: '🥦' },
  { val: 'fast_food', label: 'Gà rán / Fastfood', emoji: '🍔' },
  { val: 'banh_mi', label: 'Bánh mì / Xôi ăn sáng', emoji: '🥖' },
  { val: 'sinh_to', label: 'Trái cây / Sinh tố', emoji: '🥤' }
];

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
  const [userStats, setUserStats] = useState(null);
  const [levelInfo, setLevelInfo] = useState(null);
  const [trendingItems, setTrendingItems] = useState([]);
  const [tasteDNA, setTasteDNA] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Onboarding states
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [obStep, setObStep] = useState(0); // 0: Welcome, 1: Uni, 2: District, 3: Budget, 4: Food, 5: Finish
  const [obUniversity, setObUniversity] = useState('');
  const [obCustomUniversity, setObCustomUniversity] = useState('');
  const [obDistrict, setObDistrict] = useState('');
  const [obBudget, setObBudget] = useState('');
  const [obFood, setObFood] = useState([]);
  const [savingOnboarding, setSavingOnboarding] = useState(false);

  // Product Tour state
  const [showTour, setShowTour] = useState(false);

  const gridRef = useRef(null);

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
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          setUserData(snap.exists() ? snap.data() : { name: user.displayName || user.email, badges: [] });
        } catch { setUserData({ name: user.displayName || user.email, badges: [] }); }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => { fetchLocations(); }, []);

  useEffect(() => {
    if (userData && !userData.onboarded) {
      setShowOnboarding(true);
    } else if (userData && userData.onboarded && !userData.tourCompleted && !showOnboarding) {
      // User completed onboarding but hasn't done tour yet
      const timer = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(timer);
    }
  }, [userData, showOnboarding]);

  useEffect(() => {
    if (!currentUser) return;
    fetchStats(currentUser.uid);
    fetchTrending();
    if (locations.length > 0) fetchTaste(currentUser.uid);
  }, [currentUser, locations]);

  const fetchLocations = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'locations'), orderBy('createdAt', 'desc')));
      setLocations(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(d.data().createdAt),
      })));
    } catch { toast.error('Không thể tải địa điểm'); }
    finally { setLoading(false); }
  };

  const fetchStats = async (uid) => {
    try {
      const stats = await getUserStats(uid);
      setUserStats(stats);
      setLevelInfo(getLevelFromXP(calculateXPFromStats(stats)));
    } catch (e) { console.error(e); }
  };

  const fetchTaste = async (uid) => {
    try {
      const [l, p, r] = await Promise.all([
        getDocs(query(collection(db, 'locations'), where('createdBy', '==', uid))),
        getDocs(query(collection(db, 'posts'), where('userId', '==', uid))),
        getDocs(query(collection(db, 'reviews'), where('userId', '==', uid))),
      ]);
      setTasteDNA(computeTasteDNA(
        l.docs.map(d => ({ id: d.id, ...d.data() })),
        p.docs.map(d => ({ id: d.id, ...d.data() })),
        r.docs.map(d => ({ id: d.id, ...d.data() })),
        locations
      ));
    } catch (e) { console.error(e); }
  };

  const fetchTrending = async () => {
    try {
      const items = [];

      const postSnap = await getDocs(collection(db, 'posts'));
      postSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.status === 'approved' || !p.status)
        .sort((a, b) => ((b.upvotes || 0) * 3 + (b.commentCount || 0) * 5) - ((a.upvotes || 0) * 3 + (a.commentCount || 0) * 5))
        .slice(0, 2)
        .forEach(p => items.push({
          type: 'post', title: p.title || 'Bài viết mới', tag: 'Bài viết',
          meta: `${p.upvotes || 0} votes · ${p.commentCount || 0} bình luận`,
          href: `/post/${p.id}`,
        }));

      const safetySnap = await getDocs(query(collection(db, 'warningZones'), orderBy('createdAt', 'desc')));
      safetySnap.docs.slice(0, 2).map(d => ({ id: d.id, ...d.data() }))
        .forEach(a => items.push({
          type: 'safety', title: a.address || 'Khu vực cảnh báo', tag: 'An toàn',
          meta: (a.description || '').slice(0, 45), href: '/safety',
        }));

      const buddySnap = await getDocs(query(collection(db, 'buddyRequests'), orderBy('createdAt', 'desc')));
      buddySnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(b => b.status === 'open' || b.status === 'approved')
        .slice(0, 2)
        .forEach(b => items.push({
          type: 'buddy', tag: 'Kết nối',
          title: `Tìm ${b.type === 'roommate' ? 'bạn ở ghép' : b.type === 'study_buddy' ? 'bạn học' : 'bạn'} — ${b.university || ''}`,
          meta: b.userName || 'Ẩn danh', href: '/buddy-finder',
        }));

      locations
        .filter(l => l.status === 'approved' || !l.status)
        .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
        .slice(0, 1)
        .forEach(l => items.push({
          type: 'location', tag: 'Hot',
          title: l.name,
          meta: `${l.averageRating ? l.averageRating.toFixed(1) + '★' : 'Mới'} · ${l.reviewCount || 0} reviews`,
          href: `/location/${l.id}`,
        }));

      setTrendingItems(items.slice(0, 5));
    } catch (e) { console.error(e); }
  };

  const getAvgRating = (reviews = []) => {
    if (!reviews.length) return 0;
    return (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1);
  };

  const extractDistrict = (address) => {
    if (!address) return '';
    const a = address.toLowerCase();
    const dists = [
      ['Quận 1',['quận 1','q1','q.1']], ['Quận 2',['quận 2','q2','q.2']], ['Quận 3',['quận 3','q3','q.3']],
      ['Quận 4',['quận 4','q4','q.4']], ['Quận 5',['quận 5','q5','q.5']], ['Quận 6',['quận 6','q6','q.6']],
      ['Quận 7',['quận 7','q7','q.7']], ['Quận 8',['quận 8','q8','q.8']], ['Quận 9',['quận 9','q9','q.9']],
      ['Quận 10',['quận 10','q10','q.10']], ['Quận 11',['quận 11','q11','q.11']], ['Quận 12',['quận 12','q12','q.12']],
      ['Bình Thạnh',['bình thạnh','binh thanh']], ['Gò Vấp',['gò vấp','go vap']],
      ['Phú Nhuận',['phú nhuận','phu nhuan']], ['Tân Bình',['tân bình','tan binh']],
      ['Tân Phú',['tân phú','tan phu']], ['Bình Tân',['bình tân','binh tan']],
      ['Thủ Đức',['thủ đức','thu duc']], ['Nhà Bè',['nhà bè','nha be']],
      ['Hóc Môn',['hóc môn','hoc mon']], ['Củ Chi',['củ chi','cu chi']],
      ['Bình Chánh',['bình chánh','binh chanh']], ['Cần Giờ',['cần giờ','can gio']],
    ];
    for (const [name, kws] of dists) { for (const kw of kws) { if (a.includes(kw)) return name; } }
    return '';
  };

  const personalizedRecs = useMemo(() => {
    if (!userData || !userData.onboarded || !userData.targetDistrict || locations.length === 0) return [];
    const dist = userData.targetDistrict || '';
    const foods = userData.foodPreferences || [];
    
    let matches = locations.filter(l => {
      const addr = (l.address || '').toLowerCase();
      const name = (l.name || '').toLowerCase();
      const desc = (l.description || '').toLowerCase();
      const distLower = dist.toLowerCase();
      const inDistrict = addr.includes(distLower) || (l.district && l.district.toLowerCase() === distLower);
      
      if (l.category === 'Housing') {
        return inDistrict;
      }
      if (l.category === 'Food' || l.category === 'Cafe') {
        const matchesFood = foods.some(f => {
          const terms = f.toLowerCase().split('/').map(t => t.trim());
          return terms.some(term => 
            name.includes(term) || desc.includes(term) || l.category.toLowerCase().includes(term)
          );
        });
        return inDistrict && (foods.length === 0 || matchesFood);
      }
      return false;
    });
    
    if (matches.length === 0) {
      matches = locations.filter(l => l.averageRating >= 4.5).slice(0, 4);
    }
    return matches.slice(0, 4);
  }, [userData, locations]);

  const handleOnboardingComplete = async () => {
    if (!currentUser) return;
    setSavingOnboarding(true);
    try {
      const dataToUpdate = {
        onboarded: true,
        university: obUniversity.trim(),
        targetDistrict: obDistrict,
        budgetRange: obBudget,
        foodPreferences: obFood,
      };
      await updateUserProfile(currentUser.uid, dataToUpdate);
      setUserData(prev => ({ ...prev, ...dataToUpdate }));
      toast.success('Cá nhân hóa thành công!');
      setObStep(5);
      setTimeout(() => {
        setShowOnboarding(false);
        // Trigger product tour after onboarding
        setTimeout(() => setShowTour(true), 500);
      }, 2000);
    } catch (e) {
      console.error(e);
      toast.error('Không thể lưu thông tin onboarding.');
    } finally {
      setSavingOnboarding(false);
    }
  };

  const handleSkipOnboarding = async () => {
    if (!currentUser) return;
    try {
      await updateUserProfile(currentUser.uid, { onboarded: true });
      setUserData(prev => ({ ...prev, onboarded: true }));
      setShowOnboarding(false);
      toast.success('Đã bỏ qua thiết lập cá nhân hóa.');
    } catch (e) {
      console.error(e);
      setShowOnboarding(false);
    }
  };

  const toggleFoodPref = (val) => {
    setObFood(prev => prev.includes(val) ? prev.filter(f => f !== val) : [...prev, val]);
  };

  const processed = useMemo(() => {
    let r = locations.filter(l => l.status === 'approved' || !l.status);
    if (filter !== 'All') r = r.filter(l => l.category === filter);
    if (districtFilter !== 'All') r = r.filter(l => (l.district || extractDistrict(l.address)).toLowerCase() === districtFilter.toLowerCase());
    if (ratingFilter !== 'All') r = r.filter(l => (parseFloat(getAvgRating(l.reviews)) || 0) >= parseFloat(ratingFilter));
    if (videoFilter === 'video') r = r.filter(l => l.videoUrl);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(l => [l.name, l.address, l.description].some(s => (s || '').toLowerCase().includes(q)));
    }
    switch (sortBy) {
      case 'rating': r.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0)); break;
      case 'reviews': r.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0)); break;
      default: r.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return r;
  }, [locations, filter, searchQuery, sortBy, districtFilter, ratingFilter, videoFilter]);

  const firstName = userData?.name?.split(' ').pop() || 'Bạn';
  const greeting = getGreeting();
  const badgeCount = userData?.badges?.length || 0;
  const totalActivity = userStats ? (userStats.locationCount + userStats.reviewCount + userStats.postCount) : 0;

  const handleQuickAction = (action) => {
    if (action.filterKey) {
      setFilter(action.filterKey);
      setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50"><Navbar />
          <div className="flex items-center justify-center min-h-[60vh]"><div className="db-spinner"></div></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50/80">
        <Navbar />

        {/* ═══ 1. HERO ═══ */}
        <div className="cmd-hero db-fade-in">
          <div className="cmd-hero-glow cmd-hero-glow--1" />
          <div className="cmd-hero-glow cmd-hero-glow--2" />
          <div className="cmd-hero-glow cmd-hero-glow--3" />
          <div className="max-w-6xl mx-auto px-4 py-5 sm:py-6 relative z-10">
            <p className="cmd-greeting">
              {greeting.emoji} {greeting.text},{' '}
              <span className="cmd-greeting-name">{firstName}</span>!
            </p>
            <p className="cmd-greeting-sub">Hôm nay bạn muốn khám phá gì?</p>

            <div className="cmd-actions">
              {QUICK_ACTIONS.map((a, i) =>
                a.href ? (
                  <Link key={i} href={a.href} className="cmd-action">
                    <span className="cmd-action-emoji">{a.emoji}</span>
                    {a.label}
                  </Link>
                ) : (
                  <button key={i} onClick={() => handleQuickAction(a)} className="cmd-action">
                    <span className="cmd-action-emoji">{a.emoji}</span>
                    {a.label}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* ═══ 2. STATS ═══ */}
        <div className="cmd-stats db-fade-in db-fade-in-1">
          <div className="max-w-6xl mx-auto px-4 py-2">
            <div className="cmd-stats-row">
              {totalActivity > 0 ? (
                <>
                  {levelInfo && (
                    <div className="cmd-chip cmd-chip--level">
                      <span className="cmd-chip-icon">{levelInfo.icon}</span>
                      <span className="cmd-chip-val">Lv.{levelInfo.level}</span>
                      <span className="cmd-chip-lbl">{levelInfo.name}</span>
                      <div className="cmd-lvl-bar"><div className="cmd-lvl-fill" style={{ width: `${levelInfo.progress}%` }} /></div>
                    </div>
                  )}
                  <Link href="/profile" className="cmd-chip">
                    <span className="cmd-chip-icon">🏆</span>
                    <span className="cmd-chip-val">{badgeCount}</span>
                    <span className="cmd-chip-lbl">badges</span>
                  </Link>
                  <div className="cmd-chip">
                    <span className="cmd-chip-icon">⭐</span>
                    <span className="cmd-chip-val">{userStats.reviewCount}</span>
                    <span className="cmd-chip-lbl">reviews</span>
                  </div>
                  <div className="cmd-chip">
                    <span className="cmd-chip-icon">📍</span>
                    <span className="cmd-chip-val">{userStats.locationCount}</span>
                    <span className="cmd-chip-lbl">địa điểm</span>
                  </div>
                  <div className="cmd-chip">
                    <span className="cmd-chip-icon">📝</span>
                    <span className="cmd-chip-val">{userStats.postCount}</span>
                    <span className="cmd-chip-lbl">bài viết</span>
                  </div>
                  {tasteDNA?.total > 0 && (
                    <Link href="/profile" className="cmd-chip cmd-chip--taste">
                      <span className="cmd-chip-icon">🧬</span>
                      <span className="cmd-chip-val">{tasteDNA.personalityTitle}</span>
                    </Link>
                  )}
                </>
              ) : (
                <Link href="/add-location" className="cmd-chip cmd-chip--cta">
                  <span className="cmd-chip-icon">🎯</span>
                  <span className="cmd-chip-val">Bắt đầu hành trình — thêm địa điểm đầu tiên!</span>
                  <span style={{ fontSize: '0.7rem', color: '#3b82f6' }}>→</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ═══ GỢI Ý CÁ NHÂN HÓA ONBOARDING ═══ */}
        {userData?.onboarded && personalizedRecs.length > 0 && (
          <div className="cmd-personalized-section py-5 border-b border-gray-100/90 db-fade-in db-fade-in-2">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="personal-rec-badge">✨ Dành riêng cho bạn</span>
                  <span className="text-xs text-gray-500 font-medium">Đề xuất dựa trên trường & quận bạn chọn</span>
                </div>
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {userData.university} · {userData.targetDistrict}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {personalizedRecs.map(loc => (
                  <LocationCard key={loc.id} location={loc} averageRating={getAvgRating(loc.reviews)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ 3. STORIES ═══ */}
        <div className="bg-white border-b border-gray-100/90 shadow-sm db-fade-in db-fade-in-2 relative z-20">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="cmd-header">
              <span className="cmd-title">⚡ Khoảnh khắc Sinh viên
                <span className="flex items-center gap-1 bg-rose-50 text-rose-600 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border border-rose-100 ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 live-dot-ping"></span>Live
                </span>
              </span>
              <Link href="/shorts" className="cmd-link">Xem tất cả →</Link>
            </div>
            <div className="stories-strip flex gap-3.5 overflow-x-auto pb-1 pt-0.5">
              <button onClick={() => setShowCameraModal(true)} className="flex flex-col items-center gap-1.5 flex-shrink-0 story-add-button group">
                <div className="relative w-16 h-16 rounded-full story-add-gradient flex items-center justify-center story-add-ring">
                  <span className="text-2xl camera-emoji">📸</span>
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black border-2 border-white shadow-md transition-transform group-hover:scale-110">+</div>
                </div>
                <span className="text-[10px] font-bold text-gray-500 group-hover:text-indigo-600 transition-colors">Chụp ngay</span>
              </button>
              {locketCheckIns.length === 0 ? (
                <div className="flex items-center text-gray-400 text-xs italic px-4">Chưa có check-in nào 🎉</div>
              ) : locketCheckIns.map(loc => {
                const avatar = loc.createdByAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(loc.createdByName || 'U')}&background=6366f1&color=fff&size=64`;
                return (
                  <Link key={loc.id} href={`/shorts?activeId=${loc.id}`} className="flex flex-col items-center gap-1.5 flex-shrink-0 story-item">
                    <div className="relative w-16 h-16 rounded-full p-0.5 story-neon-ring">
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-gray-50">
                        <img src={loc.imageUrl} alt={loc.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white overflow-hidden bg-white shadow-md">
                        <img src={avatar} alt="" className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-600 max-w-[68px] truncate text-center">{loc.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ 4. TRENDING — Clean numbered list ═══ */}
        {trendingItems.length > 0 && (
          <div className="cmd-trending db-fade-in db-fade-in-3">
            <div className="max-w-6xl mx-auto px-4 py-3">
              <div className="cmd-header">
                <span className="cmd-title">🔥 Trending hôm nay</span>
              </div>
              <div className="cmd-trend-list">
                {trendingItems.map((item, i) => (
                  <Link key={i} href={item.href} className="cmd-trend-item">
                    <span className={`cmd-trend-num ${i === 0 ? 'cmd-trend-num--hot' : i === 1 ? 'cmd-trend-num--warm' : ''}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={`cmd-trend-dot cmd-trend-dot--${item.type}`} />
                    <div className="cmd-trend-body">
                      <div className="cmd-trend-title">{item.title}</div>
                      <div className="cmd-trend-meta">{item.meta}</div>
                    </div>
                    <span className={`cmd-trend-tag cmd-trend-tag--${item.type}`}>{item.tag}</span>
                    <span className="cmd-trend-arrow">›</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ 5. SEARCH + FILTERS ═══ */}
        <div ref={gridRef} className="db-sticky-toolbar bg-white/95 border-b border-gray-100/80 db-fade-in db-fade-in-4">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="mb-2.5">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all" placeholder="Tìm quán ăn, cafe, nhà trọ..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 mb-2.5" style={{ scrollbarWidth: 'none' }}>
              {[
                { val: districtFilter, set: setDistrictFilter, opts: [['All','📍 Tất cả quận'],['Quận 1','Q.1'],['Quận 2','Q.2'],['Quận 3','Q.3'],['Quận 4','Q.4'],['Quận 5','Q.5'],['Quận 6','Q.6'],['Quận 7','Q.7'],['Quận 8','Q.8'],['Quận 9','Q.9'],['Quận 10','Q.10'],['Quận 11','Q.11'],['Quận 12','Q.12'],['Bình Thạnh','B.Thạnh'],['Gò Vấp','G.Vấp'],['Phú Nhuận','P.Nhuận'],['Tân Bình','T.Bình'],['Tân Phú','T.Phú'],['Bình Tân','B.Tân'],['Thủ Đức','T.Đức'],['Bình Chánh','B.Chánh'],['Hóc Môn','H.Môn'],['Củ Chi','C.Chi'],['Nhà Bè','N.Bè'],['Cần Giờ','C.Giờ']] },
                { val: ratingFilter, set: setRatingFilter, opts: [['All','⭐ Sao'],['4.5','4.5+'],['4.0','4.0+'],['3.0','3.0+']] },
                { val: videoFilter, set: setVideoFilter, opts: [['All','🎞️ Tất cả'],['video','🎬 Video']] },
                { val: sortBy, set: setSortBy, opts: [['newest','🕐 Mới nhất'],['rating','⭐ Rating'],['reviews','💬 Reviews']] },
              ].map((sel, i) => (
                <select key={i} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-semibold text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none flex-shrink-0" value={sel.val} onChange={e => sel.set(e.target.value)}
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 8px center', backgroundRepeat: 'no-repeat', backgroundSize: '12px', paddingRight: '26px' }}>
                  {sel.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {categories.map(cat => (
                <button key={cat.key} onClick={() => setFilter(cat.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                    filter === cat.key
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}>
                  <span className="text-sm">{cat.emoji}</span>{cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ 6. GRID ═══ */}
        <main className="max-w-6xl mx-auto px-4 pt-5 pb-24">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-gray-800">📍 Student&apos;s Choice</p>
              <span className="cmd-verified">✓ Verified</span>
              <span className="text-xs text-gray-400 font-medium">
                · {processed.length} địa điểm
                {searchQuery.trim() && <> cho &ldquo;{searchQuery}&rdquo;</>}
              </span>
            </div>
            {filter !== 'All' && (
              <button onClick={() => setFilter('All')} className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 transition-colors">Xóa filter ✕</button>
            )}
          </div>

          {processed.length === 0 ? (
            <div className="text-center py-16 db-fade-in">
              <div className="text-5xl mb-4">{searchQuery.trim() ? '🔍' : '📍'}</div>
              <h3 className="text-lg font-bold text-gray-700 mb-1">{searchQuery.trim() ? 'Không tìm thấy kết quả' : 'Chưa có địa điểm nào'}</h3>
              <p className="text-sm text-gray-400 mb-4">{searchQuery.trim() ? 'Thử thay đổi từ khóa' : 'Hãy là người đầu tiên!'}</p>
              {!searchQuery.trim() && (
                <Link href="/add-location" className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm">➕ Thêm địa điểm</Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 db-fade-in db-fade-in-5">
              {processed.map(loc => <LocationCard key={loc.id} location={loc} averageRating={getAvgRating(loc.reviews)} />)}
            </div>
          )}
        </main>

        {/* FAB */}
        <Link href="/add-location"
          style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 40, width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)', textDecoration: 'none', fontSize: '1.4rem', fontWeight: 700, transition: 'all 0.2s' }}
          onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(79,70,229,0.5)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(79,70,229,0.35)'; }}
        >+</Link>

        {showCameraModal && <LocketCameraModal onClose={() => setShowCameraModal(false)} onUploadSuccess={fetchLocations} />}

        {/* PRODUCT TOUR */}
        {showTour && (
          <ProductTour
            onComplete={async () => {
              setShowTour(false);
              if (currentUser) {
                try { await updateUserProfile(currentUser.uid, { tourCompleted: true }); } catch (e) { console.error(e); }
              }
            }}
            onSkip={async () => {
              setShowTour(false);
              if (currentUser) {
                try { await updateUserProfile(currentUser.uid, { tourCompleted: true }); } catch (e) { console.error(e); }
              }
            }}
          />
        )}

        {/* ONBOARDING FLOW MODAL */}
        {showOnboarding && (
          <div className="onboarding-overlay">
            <div className="onboarding-card">
              <div className="onboarding-progress-container">
                <div className="onboarding-progress-bar">
                  <div className="onboarding-progress-fill" style={{ width: `${(obStep / 5) * 100}%` }} />
                </div>
                <span className="onboarding-step-text">Bước {obStep} / 4</span>
              </div>

              {obStep === 0 && (
                <div className="text-center py-4">
                  <span className="text-5xl block mb-4">👋</span>
                  <h2 className="onboarding-title">Chào mừng bạn đến với CityZ Kit!</h2>
                  <p className="onboarding-desc mb-2">
                    Để bắt đầu cuộc sống đại học tại TP.HCM một cách suôn sẻ nhất, hãy dành 1 phút để thiết lập hồ sơ cá nhân hóa của bạn.
                  </p>
                  <p className="text-[11px] text-amber-700 bg-amber-50 rounded-xl p-3 mb-5 font-semibold leading-relaxed border border-amber-100">
                    💡 <strong>Lời khuyên:</strong> Bạn nên hoàn thành thiết lập này để chúng tôi đề xuất các địa điểm ẩm thực, nhà trọ và bạn bè học tập tốt nhất, phù hợp nhất với nhu cầu của riêng bạn!
                  </p>
                  <button onClick={() => setObStep(1)} className="onboarding-btn-next w-full mb-3">Bắt đầu ngay 🚀</button>
                  <button onClick={handleSkipOnboarding} className="onboarding-btn-prev text-xs text-gray-400 hover:text-gray-600 block mx-auto bg-transparent border-none cursor-pointer">
                    Bỏ qua thiết lập (Không khuyên dùng)
                  </button>
                </div>
              )}

              {obStep === 1 && (
                <div>
                  <h2 className="onboarding-title">Bạn học trường nào? 🎓</h2>
                  <p className="onboarding-desc">Nhập tên trường của bạn hoặc chọn nhanh từ danh sách gợi ý bên dưới.</p>
                  
                  <input 
                    type="text" 
                    value={obUniversity} 
                    onChange={e => setObUniversity(e.target.value)}
                    placeholder="Nhập tên trường đại học của bạn..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" 
                  />

                  <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">Gợi ý nhanh:</p>
                  <div className="onboarding-grid">
                    {UNIVERSITIES.map(uni => (
                      <button key={uni} onClick={() => setObUniversity(uni)}
                        className={`onboarding-opt-btn ${obUniversity === uni ? 'onboarding-opt-btn--active' : ''}`}>
                        {uni}
                      </button>
                    ))}
                  </div>

                  <div className="onboarding-footer-btns">
                    <button onClick={() => setObStep(0)} className="onboarding-btn-prev">Quay lại</button>
                    <button onClick={() => { if (!obUniversity.trim()) return toast.error('Vui lòng chọn hoặc tự nhập tên trường!'); setObStep(2); }}
                      className="onboarding-btn-next">Tiếp tục →</button>
                  </div>
                </div>
              )}

              {obStep === 2 && (
                <div>
                  <h2 className="onboarding-title">Khu vực sinh sống / học tập chính? 📍</h2>
                  <p className="onboarding-desc">Giúp hiển thị các quán ăn, nhà trọ và cảnh báo an toàn gần nhất với bạn.</p>
                  <div className="onboarding-grid">
                    {DISTRICTS.map(dist => (
                      <button key={dist} onClick={() => setObDistrict(dist)}
                        className={`onboarding-opt-btn ${obDistrict === dist ? 'onboarding-opt-btn--active' : ''}`}>
                        📍 {dist}
                      </button>
                    ))}
                  </div>
                  <div className="onboarding-footer-btns">
                    <button onClick={() => setObStep(1)} className="onboarding-btn-prev">Quay lại</button>
                    <button onClick={() => { if (!obDistrict) return toast.error('Vui lòng chọn quận!'); setObStep(3); }}
                      className="onboarding-btn-next">Tiếp tục →</button>
                  </div>
                </div>
              )}

              {obStep === 3 && (
                <div>
                  <h2 className="onboarding-title">Ngân sách thuê trọ hàng tháng? 🏠</h2>
                  <p className="onboarding-desc">Chúng tôi sẽ gợi ý phòng trọ sinh viên phù hợp túi tiền của bạn.</p>
                  <div className="onboarding-grid">
                    {BUDGETS.map(b => (
                      <button key={b.val} onClick={() => setObBudget(b.label)}
                        className={`onboarding-opt-btn ${obBudget === b.label ? 'onboarding-opt-btn--active' : ''}`}>
                        <span className="onboarding-opt-btn-emoji">{b.emoji}</span>
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <div className="onboarding-footer-btns">
                    <button onClick={() => setObStep(2)} className="onboarding-btn-prev">Quay lại</button>
                    <button onClick={() => { if (!obBudget) return toast.error('Vui lòng chọn ngân sách!'); setObStep(4); }}
                      className="onboarding-btn-next">Tiếp tục →</button>
                  </div>
                </div>
              )}

              {obStep === 4 && (
                <div>
                  <h2 className="onboarding-title">Gu ăn uống bạn yêu thích? 🍜</h2>
                  <p className="onboarding-desc">Chọn một hoặc nhiều gu ẩm thực để nhận gợi ý quán ăn ngon bổ rẻ (chọn tối thiểu 1).</p>
                  <div className="onboarding-grid">
                    {FOOD_PREFS.map(f => {
                      const isActive = obFood.includes(f.label);
                      return (
                        <button key={f.val} onClick={() => toggleFoodPref(f.label)}
                          className={`onboarding-opt-btn ${isActive ? 'onboarding-opt-btn--active' : ''}`}>
                          <span className="onboarding-opt-btn-emoji">{f.emoji}</span>
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="onboarding-footer-btns">
                    <button onClick={() => setObStep(3)} className="onboarding-btn-prev">Quay lại</button>
                    <button onClick={() => {
                      if (obFood.length === 0) return toast.error('Vui lòng chọn ít nhất 1 gu ăn uống!');
                      handleOnboardingComplete();
                    }} disabled={savingOnboarding} className="onboarding-btn-next">
                      {savingOnboarding ? 'Đang lưu...' : 'Hoàn tất 🎉'}
                    </button>
                  </div>
                </div>
              )}

              {obStep === 5 && (
                <div className="text-center py-8">
                  <span className="text-6xl block mb-4 animate-bounce">⚡</span>
                  <h2 className="onboarding-title">Đã thiết lập xong!</h2>
                  <p className="onboarding-desc">Hệ thống đang chuẩn bị Dashboard cá nhân hóa riêng cho bạn...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
