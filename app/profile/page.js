'use client';

import '@/app/styles/profile.css';
import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { 
  updateUserAvatar, 
  updateUserProfile, 
  getUserStats, 
  calculateXPFromStats, 
  getLevelFromXP,
  getUserPosts,
  getUserLocations,
  getUserReviews,
  deletePost,
  updatePost,
  deleteLocation,
  deleteReview,
  getBookmarkedPosts,
  getBookmarkedLocations,
  bookmarkLocation,
  bookmarkPost,
  computeTasteDNA,
  computeSharedVibes,
} from '@/lib/firestore';
import { compressAndToBase64 } from '@/lib/imageHelper';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import RatingStars from '@/components/RatingStars';
import FlairBadge from '@/components/FlairBadge';
import TasteDNA from '@/components/TasteDNA';
import SharedVibes from '@/components/SharedVibes';
import InsightsCard from '@/components/InsightsCard';
import MilestoneTimeline from '@/components/MilestoneTimeline';
import toast from 'react-hot-toast';


const ALL_BADGES = [
  { name: 'Explorer', icon: '🧭', desc: 'Thêm ≥1 địa điểm', color: '#3b82f6' },
  { name: 'Helper', icon: '🤝', desc: 'Viết ≥3 đánh giá', color: '#22c55e' },
  { name: 'Influencer', icon: '⭐', desc: 'Đăng ≥1 bài viết', color: '#8b5cf6' },
  { name: 'Trailblazer', icon: '🗺️', desc: 'Thêm ≥5 địa điểm', color: '#f59e0b' },
  { name: 'Critic', icon: '📝', desc: 'Viết ≥10 đánh giá', color: '#ef4444' },
  { name: 'Blogger', icon: '📰', desc: 'Đăng ≥5 bài viết', color: '#06b6d4' },
];

function CountUp({ end, duration = 1000 }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (end === 0) { setValue(0); return; }
    let start = 0;
    const startTime = performance.now();
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(eased * end));
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [end, duration]);

  return <span className="pf-countup">{value}</span>;
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const profileUid = searchParams.get('uid');

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBio, setNewBio] = useState('');
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ locationCount: 0, reviewCount: 0, postCount: 0, totalUpvotes: 0 });
  const [xpAnimated, setXpAnimated] = useState(false);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const isOwnProfile = !profileUid || (user && user.uid === profileUid);

  // Reset activeTab if guest user attempts to view private saved items
  useEffect(() => {
    if (!isOwnProfile && activeTab === 'saved') {
      setActiveTab('posts');
    }
  }, [isOwnProfile]);

  // States for user-generated content tabs
  const [activeTab, setActiveTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedLocations, setSavedLocations] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);

  // Personalization states
  const [allLocations, setAllLocations] = useState([]);
  const [myVibeData, setMyVibeData] = useState(null); // current user's data for SharedVibes

  const displayPosts = isOwnProfile ? posts : posts.filter(p => p.status === 'approved' || !p.status);
  const displayLocations = isOwnProfile ? locations : locations.filter(l => l.status === 'approved' || !l.status);

  // Edit post states
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPostTitle, setEditPostTitle] = useState('');
  const [editPostContent, setEditPostContent] = useState('');
  const [editPostCategory, setEditPostCategory] = useState('general');
  const [editPostFlair, setEditPostFlair] = useState('');
  const [isSavingPost, setIsSavingPost] = useState(false);

  const fetchUserContents = async (uid) => {
    setLoadingContent(true);
    try {
      const userUid = uid || profileUid || user?.uid;
      if (!userUid) return;
      const [userPosts, userLocations, userReviews, bookmarkedPosts, bookmarkedLocations] = await Promise.all([
        getUserPosts(userUid),
        getUserLocations(userUid),
        getUserReviews(userUid),
        getBookmarkedPosts(userUid),
        getBookmarkedLocations(userUid)
      ]);
      setPosts(userPosts);
      setLocations(userLocations);
      setReviews(userReviews);
      setSavedPosts(bookmarkedPosts);
      setSavedLocations(bookmarkedLocations);
    } catch (err) {
      console.error('Error fetching user contents:', err);
      toast.error('Không thể tải danh sách nội dung');
    } finally {
      setLoadingContent(false);
    }
  };

  const refreshStatsAndContent = async (uid) => {
    const userUid = uid || profileUid || user?.uid;
    if (!userUid) return;
    try {
      const userStats = await getUserStats(userUid);
      setStats(userStats);
      await fetchUserContents(userUid);
    } catch (err) {
      console.error('Error refreshing stats & contents:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      const targetUid = profileUid || u?.uid;
      if (targetUid) {
        try {
          const docRef = doc(db, 'users', targetUid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            setNewName(data.name || '');
            setNewBio(data.bio || '');
          } else {
            toast.error('Không tìm thấy thông tin tài khoản');
          }

          // Fetch real stats
          const userStats = await getUserStats(targetUid);
          setStats(userStats);

          // Fetch user-generated contents
          await fetchUserContents(targetUid);

          // Fetch all locations for TasteDNA category mapping
          try {
            const locsSnap = await getDocs(collection(db, 'locations'));
            setAllLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch (e) { console.error('Error fetching all locations:', e); }

          // If viewing someone else's profile, fetch current user's data for SharedVibes
          if (u && profileUid && u.uid !== profileUid) {
            try {
              const [myPosts, myLocs, myRevs] = await Promise.all([
                getUserPosts(u.uid), getUserLocations(u.uid), getUserReviews(u.uid)
              ]);
              const myStats = await getUserStats(u.uid);
              const myXp = calculateXPFromStats(myStats);
              const myLevel = getLevelFromXP(myXp);
              const locsSnap = await getDocs(collection(db, 'locations'));
              const allLocs = locsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
              const myDna = computeTasteDNA(myLocs, myPosts, myRevs, allLocs);
              setMyVibeData({
                tasteScores: myDna.scores,
                reviews: myRevs,
                allLocations: allLocs,
                level: myLevel.level,
              });
            } catch (e) { console.error('Error fetching my vibe data:', e); }
          }

          // Trigger progress bar animation
          setTimeout(() => setXpAnimated(true), 350);
        } catch (error) {
          toast.error('Lỗi khi tải hồ sơ');
          console.error(error);
        }
      } else {
        if (!profileUid && !u) {
          setUserData(null);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profileUid]);


  const handleDeletePost = async (postId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;
    try {
      await deletePost(postId);
      toast.success('Đã xóa bài viết thành công!');
      await refreshStatsAndContent(user.uid);
    } catch (err) {
      toast.error('Lỗi khi xóa bài viết: ' + err.message);
    }
  };

  const handleStartEditPost = (post) => {
    setEditingPostId(post.id);
    setEditPostTitle(post.title || '');
    setEditPostContent(post.content || '');
    setEditPostCategory(post.category || 'general');
    setEditPostFlair(post.flair || '');
  };

  const handleSaveEditPost = async (e) => {
    e.preventDefault();
    if (!editPostTitle.trim()) return toast.error('Vui lòng nhập tiêu đề');
    if (!editPostContent.trim()) return toast.error('Vui lòng nhập nội dung');
    
    setIsSavingPost(true);
    try {
      await updatePost(editingPostId, {
        title: editPostTitle.trim(),
        content: editPostContent.trim(),
        category: editPostCategory,
        flair: editPostFlair || null,
      });
      toast.success('Cập nhật bài viết thành công!');
      setEditingPostId(null);
      await fetchUserContents(user.uid);
    } catch (err) {
      toast.error('Lỗi khi chỉnh sửa bài viết: ' + err.message);
    } finally {
      setIsSavingPost(false);
    }
  };

  const handleDeleteLocation = async (locationId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa địa điểm này không? Tất cả các nhận xét của địa điểm này cũng sẽ bị xóa.')) return;
    try {
      await deleteLocation(locationId);
      toast.success('Đã xóa địa điểm thành công!');
      await refreshStatsAndContent(user.uid);
    } catch (err) {
      toast.error('Lỗi khi xóa địa điểm: ' + err.message);
    }
  };

  const handleDeleteReview = async (locationId, reviewId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đánh giá này không?')) return;
    try {
      await deleteReview(locationId, reviewId);
      toast.success('Đã xóa đánh giá thành công!');
      await refreshStatsAndContent(user.uid);
    } catch (err) {
      toast.error('Lỗi khi xóa đánh giá: ' + err.message);
    }
  };

  const handleUnsavePost = async (postId) => {
    if (!window.confirm('Bạn có muốn bỏ lưu bài viết này không?')) return;
    try {
      await bookmarkPost(postId, user.uid);
      toast.success('Đã bỏ lưu bài viết!');
      await fetchUserContents(user.uid);
    } catch (err) {
      toast.error('Lỗi khi bỏ lưu bài viết');
    }
  };

  const handleUnsaveLocation = async (locationId) => {
    if (!window.confirm('Bạn có muốn bỏ lưu địa điểm này không?')) return;
    try {
      await bookmarkLocation(locationId, user.uid);
      toast.success('Đã bỏ lưu địa điểm!');
      await fetchUserContents(user.uid);
    } catch (err) {
      toast.error('Lỗi khi bỏ lưu địa điểm');
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Tối đa 5MB');
      return;
    }

    setUploadingCover(true);
    try {
      const base64 = await compressAndToBase64(file, 935, 320, 0.7);
      await updateUserProfile(user.uid, { coverUrl: base64 });
      setUserData(prev => ({ ...prev, coverUrl: base64 }));
      toast.success('Cập nhật ảnh bìa thành công!');
    } catch (err) {
      toast.error('Lỗi tải ảnh bìa: ' + err.message);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh quá lớn! Tối đa 5MB');
      return;
    }

    setUploading(true);
    try {
      const base64 = await compressAndToBase64(file, 300, 300, 0.7);
      await updateUserAvatar(user.uid, base64);
      setUserData(prev => ({ ...prev, avatarUrl: base64 }));
      toast.success('Cập nhật ảnh đại diện thành công!');
    } catch (err) {
      toast.error('Lỗi tải ảnh: ' + err.message);
    } finally {
      setUploading(false);
      setShowAvatarModal(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleAvatarDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ảnh đại diện này không?')) return;
    setUploading(true);
    try {
      await updateUserAvatar(user.uid, null);
      setUserData(prev => ({ ...prev, avatarUrl: null }));
      toast.success('Đã xóa ảnh đại diện thành công!');
    } catch (err) {
      toast.error('Lỗi khi xóa ảnh đại diện: ' + err.message);
    } finally {
      setUploading(false);
      setShowAvatarModal(false);
    }
  };

  const handleSaveName = async () => {
    if (!user || !newName.trim()) return;
    try {
      await updateUserProfile(user.uid, { name: newName.trim() });
      setUserData(prev => ({ ...prev, name: newName.trim() }));
      setEditingName(false);
      toast.success('Đã cập nhật tên!');
    } catch (err) {
      toast.error('Lỗi cập nhật tên');
    }
  };

  const handleSaveBio = async () => {
    if (!user) return;
    try {
      await updateUserProfile(user.uid, { bio: newBio.trim() });
      setUserData(prev => ({ ...prev, bio: newBio.trim() }));
      setEditingBio(false);
      toast.success('Đã cập nhật giới thiệu!');
    } catch (err) {
      toast.error('Lỗi cập nhật giới thiệu');
    }
  };
  const handleTriggerReonboarding = async () => {
    if (!user) return;
    try {
      const { doc: fsDoc, updateDoc } = await import('firebase/firestore');
      const docRef = fsDoc(db, 'users', user.uid);
      await updateDoc(docRef, { onboarded: false });
      toast.success('Hệ thống sẽ chuyển hướng bạn về Trang chủ để thực hiện thiết lập!');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (e) {
      console.error(e);
      toast.error('Có lỗi xảy ra.');
    }
  };

  const displayName = userData?.name || user?.displayName || user?.email?.split('@')[0] || 'Thành viên';
  const initial = displayName.charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="pf-root">
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const xp = calculateXPFromStats(stats);
  const levelInfo = getLevelFromXP(xp);
  const earnedBadgeNames = (userData?.badges || []).map(b => b.name);

  return (
    <ProtectedRoute>
      <div className="pf-root">
        <Navbar />

        <div className="pf-container">
          {/* Cover Photo */}
          <div className="pf-cover" style={{ backgroundImage: userData?.coverUrl ? `url(${userData.coverUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className="pf-cover-shimmer" />
            {isOwnProfile && (
              <>
                <button className="pf-cover-upload-btn" onClick={() => coverInputRef.current?.click()} title="Đổi ảnh bìa">
                  📷 Chỉnh sửa ảnh bìa
                </button>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  style={{ display: 'none' }}
                />
              </>
            )}
            {uploadingCover && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.4)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                zIndex: 20
              }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )}
          </div>

          {/* Profile Header Block */}
          <div className="pf-header-wrap">
            {/* Avatar Box */}
            <div className="pf-avatar-box">
              <div
                className="pf-avatar"
                onClick={isOwnProfile ? () => setShowAvatarModal(true) : undefined}
                style={{
                  backgroundImage: userData?.avatarUrl ? `url(${userData.avatarUrl})` : 'none',
                  fontSize: userData?.avatarUrl ? 0 : undefined,
                  cursor: isOwnProfile ? 'pointer' : 'default',
                }}
              >
                {!userData?.avatarUrl && initial}
              </div>
              {isOwnProfile && (
                <>
                  <div className="pf-avatar-upload-btn" onClick={() => setShowAvatarModal(true)} title="Đổi ảnh đại diện">
                    📷
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    style={{ display: 'none' }}
                  />
                </>
              )}
              {uploading && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.4)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="pf-info-box">
              <div className="pf-meta-row">
                {editingName && isOwnProfile ? (
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="pf-edit-input"
                      autoFocus
                    />
                    <button onClick={handleSaveName} className="pf-btn-save">Lưu</button>
                    <button onClick={() => setEditingName(false)} className="pf-btn-cancel">Hủy</button>
                  </div>
                ) : (
                  <h1 className="pf-name" onClick={isOwnProfile ? () => setEditingName(true) : undefined} style={{ cursor: isOwnProfile ? 'pointer' : 'default' }} title={isOwnProfile ? "Nhấp để đổi tên" : undefined}>
                    {displayName} {isOwnProfile && '✏️'}
                  </h1>
                )}

                <span className="pf-level-badge" title={`${levelInfo.name} (Đạt được ${xp} XP)`}>
                  {levelInfo.icon} Level {levelInfo.level} ({levelInfo.name})
                </span>

                {isOwnProfile && !editingName && !editingBio && (
                  <button className="pf-btn-edit" onClick={() => setEditingBio(true)}>
                    Chỉnh sửa tiểu sử
                  </button>
                )}
              </div>

              {/* Stats Row */}
              <ul className="pf-stats-row">
                <li className="pf-stat-item">
                  <span className="pf-stat-val"><CountUp end={stats.locationCount} /></span> địa điểm
                </li>
                <li className="pf-stat-item">
                  <span className="pf-stat-val"><CountUp end={stats.postCount} /></span> bài viết
                </li>
                <li className="pf-stat-item">
                  <span className="pf-stat-val"><CountUp end={stats.reviewCount} /></span> đánh giá
                </li>
                <li className="pf-stat-item" title={`Chi tiết: Địa điểm x50 XP, Bài viết x30 XP, Đánh giá x20 XP, Upvotes x5 XP`}>
                  <span className="pf-stat-val"><CountUp end={xp} /></span> XP tích lũy
                </li>
              </ul>

              {/* Bio Box */}
              <div className="pf-bio-box">
                {isOwnProfile && <div className="pf-email">{userData?.email || user?.email}</div>}
                
                {/* Join Date & Role tag */}
                <div className="pf-meta-sub">
                  <span className="pf-join-date">📅 Tham gia: {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
                  <span className="pf-role-tag">{userData?.role === 'admin' ? '🛡️ Admin' : '🎓 Thành viên'}</span>
                </div>

                {editingBio && isOwnProfile ? (
                  <div>
                    <textarea
                      value={newBio}
                      onChange={(e) => setNewBio(e.target.value)}
                      placeholder="Viết một vài mô tả ngắn về bạn..."
                      rows={2}
                      maxLength={150}
                      className="pf-edit-textarea"
                      autoFocus
                    />
                    <div className="pf-edit-actions">
                      <button onClick={handleSaveBio} className="pf-btn-save">Lưu</button>
                      <button onClick={() => setEditingBio(false)} className="pf-btn-cancel">Hủy</button>
                    </div>
                  </div>
                ) : (
                  <p
                    className={`pf-bio-text ${!userData?.bio ? 'pf-bio-placeholder' : ''}`}
                    onClick={isOwnProfile ? () => setEditingBio(true) : undefined}
                    style={{ cursor: isOwnProfile ? 'pointer' : 'default' }}
                    title={isOwnProfile ? "Nhấp để thêm tiểu sử" : undefined}
                  >
                    {userData?.bio || (isOwnProfile ? '+ Thêm giới thiệu ngắn để mọi người hiểu hơn về bạn' : 'Chưa có giới thiệu.')}
                  </p>
                )}
              </div>

              {/* XP Progress — Inline */}
              <div className="pf-xp-inline">
                <div className="pf-xp-info">
                  {levelInfo.nextLevel ? (
                    <>
                      <span>Tiến trình: {Math.round(levelInfo.progress)}%</span>
                      <span>Còn {levelInfo.xpToNext} XP → Lv.{levelInfo.nextLevel.level}</span>
                    </>
                  ) : (
                    <span>🎉 Cấp độ tối đa!</span>
                  )}
                </div>
                <div className="pf-xp-bar-bg">
                  <div
                    className="pf-xp-bar-fill"
                    style={{
                      width: xpAnimated ? `${levelInfo.progress}%` : '0%',
                    }}
                  />
                </div>
              </div>

              {/* Badges chip inline row */}
              <div className="pf-badges-inline-header">
                {ALL_BADGES.map((badge) => {
                  const isUnlocked = earnedBadgeNames.includes(badge.name);
                  return (
                    <div
                      key={badge.name}
                      className={`pf-badge-chip ${isUnlocked ? 'pf-badge-chip-unlocked' : 'pf-badge-chip-locked'}`}
                      title={isUnlocked ? `✅ ${badge.desc}` : `🔒 ${badge.desc}`}
                    >
                      <span className="pf-badge-chip-emoji">{badge.icon}</span>
                      <span>{badge.name}</span>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

          {/* ═══ BENTO GRID — Compact Personalization ═══ */}
          <div className="pf-bento-grid">
            {/* ── Card 1: Taste DNA (Radar Chart) ──────────── */}
            <div className="pf-bento-card pf-bento-card-taste">
              <h3 className="pf-bento-card-title">🧬 Taste DNA</h3>
              <TasteDNA
                locations={displayLocations}
                posts={displayPosts}
                reviews={reviews}
                allLocations={allLocations}
                compact
              />
            </div>

            {/* ── Card 2: Hành trình (Timeline compact) ────── */}
            <div className="pf-bento-card pf-bento-card-timeline">
              <h3 className="pf-bento-card-title">🏅 Hành trình</h3>
              <MilestoneTimeline
                userData={userData}
                locations={displayLocations}
                posts={displayPosts}
                reviews={reviews}
                compact
                maxItems={3}
              />
            </div>

            {/* ── Card 3: Điểm chung (SharedVibes) — Chỉ hiện khi xem profile người khác ── */}
            {!isOwnProfile && user && (
              <div className="pf-bento-card pf-bento-card-shared">
                <h3 className="pf-bento-card-title">🤝 Điểm chung</h3>
                {(() => {
                  const theirDna = computeTasteDNA(displayLocations, displayPosts, reviews, allLocations);
                  const theirVibeData = {
                    tasteScores: theirDna.scores,
                    reviews: reviews,
                    allLocations: allLocations,
                    level: levelInfo.level,
                  };
                  return (
                    <SharedVibes
                      myData={myVibeData}
                      theirData={theirVibeData}
                      theirName={displayName}
                    />
                  );
                })()}
              </div>
            )}

            {/* ── Card 4: Cá nhân hóa (Personalization) — Chỉ hiện khi xem profile của mình ── */}
            {isOwnProfile && (
              <div className="pf-bento-card pf-bento-card-personalization">
                <h3 className="pf-bento-card-title">✨ Cá nhân hóa</h3>
                {userData?.onboarded ? (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-3 text-xs mt-1">
                      <div>
                        <span className="font-semibold text-gray-400 block text-[10px] uppercase">Trường học</span>
                        <span className="text-gray-700 font-bold block truncate">{userData.university || 'Chưa chọn'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-400 block text-[10px] uppercase">Khu vực trọ</span>
                        <span className="text-gray-700 font-bold block truncate">{userData.targetDistrict || 'Chưa chọn'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-400 block text-[10px] uppercase">Ngân sách trọ</span>
                        <span className="text-gray-700 font-bold block truncate">{userData.budgetRange || 'Chưa chọn'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-400 block text-[10px] uppercase">Thẻ ẩm thực</span>
                        <span className="text-gray-700 font-bold block truncate">{(userData.foodPreferences || []).join(', ') || 'Chưa chọn'}</span>
                      </div>
                    </div>
                    <div className="flex justify-end mt-2 pt-2 border-t border-gray-100/50">
                      <button 
                        onClick={handleTriggerReonboarding} 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3 py-1 rounded-lg shadow-sm transition-all"
                      >
                        ✏️ Thiết lập lại
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 py-2 items-center text-center">
                    <span className="text-2xl">🎯</span>
                    <p className="text-xs font-semibold text-gray-700">Chưa thiết lập cá nhân hóa.</p>
                    <button 
                      onClick={handleTriggerReonboarding} 
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm transition-all mt-1"
                    >
                      ⚡ Thiết lập ngay
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Facebook/Instagram Style Manage Content Section */}
          <div className="pf-tabs">
            <button 
              className={`pf-tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              📝 Bài viết <span className="pf-tab-count">{displayPosts.length}</span>
            </button>
            <button 
              className={`pf-tab-btn ${activeTab === 'locations' ? 'active' : ''}`}
              onClick={() => setActiveTab('locations')}
            >
              📍 Địa điểm <span className="pf-tab-count">{displayLocations.length}</span>
            </button>
            <button 
              className={`pf-tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('reviews')}
            >
              ⭐ Đánh giá <span className="pf-tab-count">{reviews.length}</span>
            </button>
            {isOwnProfile && (
              <button 
                className={`pf-tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
                onClick={() => setActiveTab('saved')}
              >
                📁 Đã lưu <span className="pf-tab-count">{savedPosts.length + savedLocations.length}</span>
              </button>
            )}
          </div>

          <div className="pf-content-grid">
            {loadingContent ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : activeTab === 'posts' ? (
              displayPosts.length === 0 ? (
                <div className="pf-empty-state">
                  <div className="pf-empty-icon">📝</div>
                  <div className="pf-empty-title">
                    {isOwnProfile ? 'Bạn chưa đăng bài viết nào' : `${displayName} chưa đăng bài viết nào`}
                  </div>
                  {isOwnProfile && (
                    <>
                      <div className="pf-empty-desc">Chia sẻ ý kiến, câu hỏi hoặc kinh nghiệm của bạn với cộng đồng ngay nhé.</div>
                      <Link href="/blog" className="pf-action-btn pf-action-btn-view" style={{ marginTop: '0.5rem', background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }}>Đăng bài ngay</Link>
                    </>
                  )}
                </div>
              ) : (
                displayPosts.map(post => (
                  <div key={post.id} className="pf-card">
                    {editingPostId === post.id ? (
                      <form onSubmit={handleSaveEditPost} className="pf-edit-card-form">
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2937' }}>Chỉnh sửa bài viết</h3>
                        
                        <div className="pf-edit-field">
                          <label>Tiêu đề</label>
                          <input 
                            type="text" 
                            value={editPostTitle} 
                            onChange={(e) => setEditPostTitle(e.target.value)} 
                            required 
                          />
                        </div>

                        <div className="pf-edit-field">
                          <label>Nội dung</label>
                          <textarea 
                            value={editPostContent} 
                            onChange={(e) => setEditPostContent(e.target.value)} 
                            required 
                            rows={4}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div className="pf-edit-field">
                            <label>Danh mục</label>
                            <select value={editPostCategory} onChange={(e) => setEditPostCategory(e.target.value)}>
                              <option value="general">Tổng hợp</option>
                              <option value="housing">Nhà trọ</option>
                              <option value="food">Ẩm thực</option>
                              <option value="academic">Học tập</option>
                              <option value="social">Xã hội</option>
                            </select>
                          </div>
                          
                          <div className="pf-edit-field">
                            <label>Flair</label>
                            <select value={editPostFlair || ''} onChange={(e) => setEditPostFlair(e.target.value || null)}>
                              <option value="">Không có</option>
                              <option value="DISCUSSION">DISCUSSION</option>
                              <option value="QUESTION">QUESTION</option>
                              <option value="REVIEW">REVIEW</option>
                              <option value="URGENT">URGENT</option>
                              <option value="ANNOUNCEMENT">ANNOUNCEMENT</option>
                            </select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button type="button" onClick={() => setEditingPostId(null)} className="pf-btn-cancel">Hủy</button>
                          <button type="submit" disabled={isSavingPost} className="pf-btn-save">
                            {isSavingPost ? 'Đang lưu...' : 'Lưu'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="pf-card-header">
                          <h3 className="pf-card-title">
                            <Link href={`/post/${post.id}`}>{post.title}</Link>
                          </h3>
                          {isOwnProfile && (
                            <span className={`pf-status-badge ${
                              post.status === 'rejected' ? 'pf-status-rejected' : 
                              post.status === 'pending' ? 'pf-status-pending' : 'pf-status-approved'
                            }`}>
                              {post.status === 'rejected' ? '❌ Từ chối' : 
                               post.status === 'pending' ? '⏳ Chờ duyệt' : '✓ Đã duyệt'}
                            </span>
                          )}
                        </div>
                        
                        <div className="pf-card-meta">
                          <span className="pf-card-category">
                            {post.category === 'housing' ? '🏠 Nhà trọ' : 
                             post.category === 'food' ? '🍜 Ẩm thực' :
                             post.category === 'academic' ? '📚 Học tập' :
                             post.category === 'social' ? '🎉 Xã hội' : '💬 Tổng hợp'}
                          </span>
                          {post.flair && <FlairBadge flair={post.flair} />}
                          <span>•</span>
                          <span>Đăng ngày {post.createdAt ? (post.createdAt.toDate ? post.createdAt.toDate().toLocaleDateString('vi-VN') : new Date(post.createdAt).toLocaleDateString('vi-VN')) : '—'}</span>
                        </div>

                        <p className="pf-card-body">
                          {post.content && post.content.length > 200 
                            ? `${post.content.substring(0, 200)}...` 
                            : post.content}
                        </p>

                        <div className="pf-card-footer">
                          <div className="pf-card-stats">
                            <span>👍 {post.likes || post.upvotes || 0} lượt thích</span>
                            <span>💬 {post.commentCount || 0} bình luận</span>
                          </div>
                          
                          <div className="pf-card-actions">
                            <Link href={`/post/${post.id}`} className="pf-action-btn pf-action-btn-view">
                              🔗 Xem
                            </Link>
                            {isOwnProfile && (
                              <>
                                <button onClick={() => handleStartEditPost(post)} className="pf-action-btn pf-action-btn-edit">
                                  ✏️ Sửa
                                </button>
                                <button onClick={() => handleDeletePost(post.id)} className="pf-action-btn pf-action-btn-delete">
                                  🗑️ Xóa
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )
            ) : activeTab === 'locations' ? (
              displayLocations.length === 0 ? (
                <div className="pf-empty-state">
                  <div className="pf-empty-icon">📍</div>
                  <div className="pf-empty-title">
                    {isOwnProfile ? 'Bạn chưa thêm địa điểm nào' : `${displayName} chưa thêm địa điểm nào`}
                  </div>
                  {isOwnProfile && (
                    <>
                      <div className="pf-empty-desc">Giới thiệu những địa điểm chất lượng quanh trường cho các bạn khác nhé.</div>
                      <Link href="/add-location" className="pf-action-btn pf-action-btn-view" style={{ marginTop: '0.5rem', background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }}>Thêm địa điểm ngay</Link>
                    </>
                  )}
                </div>
              ) : (
                displayLocations.map(loc => (
                  <div key={loc.id} className="pf-card">
                    <div className="pf-card-header">
                      <h3 className="pf-card-title">
                        <Link href={`/location/${loc.id}`}>{loc.name}</Link>
                      </h3>
                      {isOwnProfile && (
                        <span className={`pf-status-badge ${
                          loc.status === 'rejected' ? 'pf-status-rejected' : 
                          loc.status === 'pending' ? 'pf-status-pending' : 'pf-status-approved'
                        }`}>
                          {loc.status === 'rejected' ? '❌ Từ chối' : 
                           loc.status === 'pending' ? '⏳ Chờ duyệt' : '✓ Đã duyệt'}
                        </span>
                      )}
                    </div>

                    <div className="pf-card-meta">
                      <span className="pf-card-category">{loc.category}</span>
                      <span>•</span>
                      <span>{loc.address}</span>
                    </div>

                    <p className="pf-card-body">
                      {loc.description && loc.description.length > 200 
                        ? `${loc.description.substring(0, 200)}...` 
                        : loc.description}
                    </p>

                    <div className="pf-card-footer">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <RatingStars rating={loc.averageRating || 0} />
                        <span style={{ fontSize: '0.82rem', color: '#8e8e8e' }}>({loc.reviewCount || 0} đánh giá)</span>
                      </div>

                      <div className="pf-card-actions">
                        <Link href={`/location/${loc.id}`} className="pf-action-btn pf-action-btn-view">
                          🔗 Xem
                        </Link>
                        {isOwnProfile && (
                          <>
                            <Link href={`/location/${loc.id}`} className="pf-action-btn pf-action-btn-edit">
                              ✏️ Sửa
                            </Link>
                            <button onClick={() => handleDeleteLocation(loc.id)} className="pf-action-btn pf-action-btn-delete">
                              🗑️ Xóa
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : activeTab === 'reviews' ? (
              reviews.length === 0 ? (
                <div className="pf-empty-state">
                  <div className="pf-empty-icon">⭐</div>
                  <div className="pf-empty-title">
                    {isOwnProfile ? 'Bạn chưa viết đánh giá nào' : `${displayName} chưa viết đánh giá nào`}
                  </div>
                  {isOwnProfile && (
                    <>
                      <div className="pf-empty-desc">Nhận xét của bạn sẽ giúp các bạn sinh viên khác có cái nhìn chân thực hơn.</div>
                      <Link href="/dashboard" className="pf-action-btn pf-action-btn-view" style={{ marginTop: '0.5rem', background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }}>Khám phá địa điểm</Link>
                    </>
                  )}
                </div>
              ) : (
                reviews.map(rev => (
                  <div key={rev.id} className="pf-card">
                    <div className="pf-card-header">
                      <h3 className="pf-card-title" style={{ fontSize: '0.95rem' }}>
                        Đánh giá về: <Link href={`/location/${rev.locationId}`} style={{ color: '#3b82f6', textDecoration: 'underline' }}>{rev.locationName}</Link>
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: '#8e8e8e' }}>
                        {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('vi-VN') : '—'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '-0.25rem' }}>
                      <RatingStars rating={rev.rating || 0} />
                    </div>

                    <p className="pf-card-body" style={{ fontStyle: 'italic', margin: '0.25rem 0' }}>
                      "{rev.comment}"
                    </p>

                    <div className="pf-card-footer" style={{ justifyContent: 'flex-end', borderTop: 'none', paddingTop: 0 }}>
                      {isOwnProfile && (
                        <div className="pf-card-actions">
                          <button onClick={() => handleDeleteReview(rev.locationId, rev.id)} className="pf-action-btn pf-action-btn-delete">
                            🗑️ Xóa đánh giá
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )

            ) : (
              (savedPosts.length === 0 && savedLocations.length === 0) ? (
                <div className="pf-empty-state">
                  <div className="pf-empty-icon">📁</div>
                  <div className="pf-empty-title">Chưa có mục nào được lưu</div>
                  <div className="pf-empty-desc">Lưu bài viết hoặc địa điểm bạn yêu thích để xem lại nhanh chóng bất cứ lúc nào.</div>
                  <Link href="/dashboard" className="pf-action-btn pf-action-btn-view" style={{ marginTop: '0.5rem', background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }}>Khám phá ngay</Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
                  {/* Saved Locations */}
                  {savedLocations.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: '#8e8e8e', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📍 Địa điểm đã lưu ({savedLocations.length})
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {savedLocations.map(loc => (
                          <div key={loc.id} className="pf-card">
                            <div className="pf-card-header">
                              <h3 className="pf-card-title">
                                <Link href={`/location/${loc.id}`}>{loc.name}</Link>
                              </h3>
                              <span className="pf-card-category">
                                {loc.category === 'Food' ? '🍜 Ăn uống' :
                                 loc.category === 'Housing' ? '🏠 Nhà trọ' :
                                 loc.category === 'Cafe' ? '☕ Cafe' :
                                 loc.category === 'Play' ? '🎡 Vui chơi' : `🏷️ ${loc.category}`}
                              </span>
                            </div>
                            <p className="pf-card-meta">📍 {loc.address}</p>
                            <p className="pf-card-body">{loc.description && loc.description.length > 150 ? `${loc.description.substring(0, 150)}...` : loc.description}</p>
                            <div className="pf-card-footer">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <RatingStars rating={loc.averageRating || 0} />
                                <span style={{ fontSize: '0.8rem', color: '#8e8e8e' }}>({loc.reviewCount || 0} nhận xét)</span>
                              </div>
                              <div className="pf-card-actions">
                                <Link href={`/location/${loc.id}`} className="pf-action-btn pf-action-btn-view">🔗 Xem</Link>
                                <button onClick={() => handleUnsaveLocation(loc.id)} className="pf-action-btn pf-action-btn-delete">Bỏ lưu</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Saved Posts */}
                  {savedPosts.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: '#8e8e8e', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: savedLocations.length > 0 ? '1.5rem' : '0' }}>
                        📝 Bài viết đã lưu ({savedPosts.length})
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {savedPosts.map(post => (
                          <div key={post.id} className="pf-card">
                            <div className="pf-card-header">
                              <h3 className="pf-card-title">
                                <Link href={`/post/${post.id}`}>{post.title}</Link>
                              </h3>
                              <span className="pf-card-category">
                                {post.category === 'housing' ? '🏠 Nhà trọ' : 
                                 post.category === 'food' ? '🍜 Ẩm thực' :
                                 post.category === 'academic' ? '📚 Học tập' :
                                 post.category === 'social' ? '🎉 Xã hội' : '💬 Tổng hợp'}
                              </span>
                            </div>
                            <p className="pf-card-meta">
                              <span>Tác giả: {post.authorName || post.realAuthorName}</span>
                              <span>•</span>
                              <span>Đăng ngày {post.createdAt ? (post.createdAt.toDate ? post.createdAt.toDate().toLocaleDateString('vi-VN') : new Date(post.createdAt).toLocaleDateString('vi-VN')) : '—'}</span>
                            </p>
                            <p className="pf-card-body">{post.content && post.content.length > 150 ? `${post.content.substring(0, 150)}...` : post.content}</p>
                            <div className="pf-card-footer">
                              <div className="pf-card-stats">
                                <span>👍 {post.likes || post.upvotes || 0} thích</span>
                                <span>💬 {post.commentCount || 0} bình luận</span>
                              </div>
                              <div className="pf-card-actions">
                                <Link href={`/post/${post.id}`} className="pf-action-btn pf-action-btn-view">🔗 Xem</Link>
                                <button onClick={() => handleUnsavePost(post.id)} className="pf-action-btn pf-action-btn-delete">Bỏ lưu</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

        </div>

        {showAvatarModal && isOwnProfile && (
          <div className="avatar-modal-overlay" onClick={() => setShowAvatarModal(false)}>
            <div className="avatar-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="avatar-modal-header">
                <h3 className="avatar-modal-title">Ảnh đại diện</h3>
                <p className="avatar-modal-desc">Thay đổi hoặc xóa ảnh đại diện của bạn</p>
              </div>
              <div className="avatar-modal-options">
                <button
                  type="button"
                  className="avatar-modal-btn avatar-modal-btn-upload"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                >
                  📷 Tải ảnh mới lên
                </button>
                
                {userData?.avatarUrl && (
                  <button
                    type="button"
                    className="avatar-modal-btn avatar-modal-btn-delete"
                    onClick={handleAvatarDelete}
                  >
                    🗑️ Xóa ảnh hiện tại
                  </button>
                )}

                <button
                  type="button"
                  className="avatar-modal-btn avatar-modal-btn-cancel"
                  onClick={() => setShowAvatarModal(false)}
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

export default function Profile() {
  return (
    <Suspense fallback={
      <div className="pf-root">
        <Navbar />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}

