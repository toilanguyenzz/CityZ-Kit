'use client';

import '@/app/styles/profile.css';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import {
  getUserStats,
  calculateXPFromStats,
  getLevelFromXP,
  getUserPosts,
  getUserLocations,
  getUserReviews,
  computeTasteDNA,
  computeSharedVibes,
} from '@/lib/firestore';
import { getFollowCounts } from '@/lib/follow';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import RatingStars from '@/components/RatingStars';
import FlairBadge from '@/components/FlairBadge';
import TasteDNA from '@/components/TasteDNA';
import SharedVibes from '@/components/SharedVibes';
import MilestoneTimeline from '@/components/MilestoneTimeline';
import FollowButton from '@/components/FollowButton';
import MessageButton from '@/components/MessageButton';
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
  useEffect(() => {
    if (end === 0) { setValue(0); return; }
    const startTime = performance.now();
    let raf;
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * end));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [end, duration]);
  return <span className="pf-countup">{value}</span>;
}

export default function PublicProfile() {
  const params = useParams();
  const profileUid = params.uid;

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ locationCount: 0, reviewCount: 0, postCount: 0, totalUpvotes: 0 });
  const [xpAnimated, setXpAnimated] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followerCount: 0, followingCount: 0 });

  // Content tabs
  const [activeTab, setActiveTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [allLocations, setAllLocations] = useState([]);
  const [myVibeData, setMyVibeData] = useState(null);

  const isOwnProfile = user && user.uid === profileUid;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!profileUid) { setLoading(false); return; }

      try {
        // Fetch target user profile
        const docRef = doc(db, 'users', profileUid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        } else {
          toast.error('Không tìm thấy người dùng này');
          setLoading(false);
          return;
        }

        // Fetch stats
        const userStats = await getUserStats(profileUid);
        setStats(userStats);

        // Fetch follow counts
        const counts = await getFollowCounts(profileUid);
        setFollowCounts(counts);

        // Fetch content
        setLoadingContent(true);
        const [userPosts, userLocations, userReviews] = await Promise.all([
          getUserPosts(profileUid),
          getUserLocations(profileUid),
          getUserReviews(profileUid),
        ]);
        setPosts(userPosts.filter(p => p.status === 'approved' || !p.status));
        setLocations(userLocations.filter(l => l.status === 'approved' || !l.status));
        setReviews(userReviews);
        setLoadingContent(false);

        // Fetch all locations for TasteDNA
        try {
          const locsSnap = await getDocs(collection(db, 'locations'));
          setAllLocations(locsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }

        // If logged in & viewing someone else, fetch own data for SharedVibes
        if (u && u.uid !== profileUid) {
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
          } catch (e) { console.error(e); }
        }

        setTimeout(() => setXpAnimated(true), 350);
      } catch (error) {
        toast.error('Lỗi khi tải hồ sơ');
        console.error(error);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profileUid]);

  // If it's the user's own profile, redirect to /profile
  if (isOwnProfile && typeof window !== 'undefined') {
    window.location.replace('/profile');
    return null;
  }

  const displayName = userData?.name || 'Thành viên';
  const initial = displayName.charAt(0).toUpperCase();
  const xp = calculateXPFromStats(stats);
  const levelInfo = getLevelFromXP(xp);
  const earnedBadgeNames = (userData?.badges || []).map(b => b.name);

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

  if (!userData) {
    return (
      <div className="pf-root">
        <Navbar />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6rem 2rem', gap: '1rem' }}>
          <span style={{ fontSize: '3rem' }}>😕</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#374151' }}>Không tìm thấy người dùng</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Người dùng này không tồn tại hoặc đã bị xóa.</p>
          <Link href="/dashboard" style={{ color: '#3b82f6', fontWeight: 600 }}>← Quay lại trang chủ</Link>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="pf-root">
        <Navbar />
        <div className="pf-container">
          {/* Cover Photo */}
          <div className="pf-cover" style={{ backgroundImage: userData?.coverUrl ? `url(${userData.coverUrl})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className="pf-cover-shimmer" />
          </div>

          {/* Profile Header */}
          <div className="pf-header-wrap">
            <div className="pf-col-identity">
              <div className="pf-identity-top-row">
                {/* Avatar */}
                <div className="pf-avatar-box">
                  <div className="pf-avatar" style={{
                    backgroundImage: userData?.avatarUrl ? `url(${userData.avatarUrl})` : 'none',
                    fontSize: userData?.avatarUrl ? 0 : undefined,
                  }}>
                    {!userData?.avatarUrl && initial}
                  </div>
                </div>

                {/* Name + Follow Button */}
                <div className="pf-name-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h1 className="pf-name">{displayName}</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <FollowButton
                      currentUser={user}
                      targetUserId={profileUid}
                      currentUserName={user?.displayName || user?.email?.split('@')[0] || ''}
                      currentUserAvatar={null}
                      size="md"
                    />
                    <MessageButton
                      currentUser={user}
                      targetUserId={profileUid}
                      targetUserName={displayName}
                      size="md"
                    />
                    <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>
                      <strong style={{ color: '#111827' }}>{followCounts.followerCount}</strong> người theo dõi
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>
                      <strong style={{ color: '#111827' }}>{followCounts.followingCount}</strong> đang theo dõi
                    </span>
                  </div>
                </div>
              </div>

              <div className="pf-identity-bottom-block">
                <div className="pf-identity-badges">
                  <span className="pf-level-badge" title={`${levelInfo.name} (${xp} XP)`}>
                    {levelInfo.icon} Level {levelInfo.level} ({levelInfo.name})
                  </span>
                  <span className="pf-role-tag">{userData?.role === 'admin' ? '🛡️ Admin' : '🎓 Thành viên'}</span>
                </div>

                <div className="pf-contact-meta">
                  <span className="pf-join-date">📅 Tham gia: {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
                </div>

                <div className="pf-bio-text-wrap">
                  <p className={`pf-bio-text ${!userData?.bio ? 'pf-bio-placeholder' : ''}`}>
                    {userData?.bio || 'Chưa có giới thiệu.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Column */}
            <div className="pf-col-dashboard">
              <div className="pf-stats-card">
                <h4 className="pf-stats-card-title">📊 HOẠT ĐỘNG</h4>
                <div className="pf-stats-grid">
                  <div className="pf-stats-box">
                    <span className="pf-stats-box-icon">📍</span>
                    <div className="pf-stats-box-info">
                      <span className="pf-stats-box-val"><CountUp end={stats.locationCount} /></span>
                      <span className="pf-stats-box-lbl">Địa điểm</span>
                    </div>
                  </div>
                  <div className="pf-stats-box">
                    <span className="pf-stats-box-icon">📝</span>
                    <div className="pf-stats-box-info">
                      <span className="pf-stats-box-val"><CountUp end={stats.postCount} /></span>
                      <span className="pf-stats-box-lbl">Bài viết</span>
                    </div>
                  </div>
                  <div className="pf-stats-box">
                    <span className="pf-stats-box-icon">⭐</span>
                    <div className="pf-stats-box-info">
                      <span className="pf-stats-box-val"><CountUp end={stats.reviewCount} /></span>
                      <span className="pf-stats-box-lbl">Đánh giá</span>
                    </div>
                  </div>
                  <div className="pf-stats-box">
                    <span className="pf-stats-box-icon">🏆</span>
                    <div className="pf-stats-box-info">
                      <span className="pf-stats-box-val"><CountUp end={xp} /></span>
                      <span className="pf-stats-box-lbl">XP</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pf-xp-progress-card">
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
                  <div className="pf-xp-bar-fill" style={{ width: xpAnimated ? `${levelInfo.progress}%` : '0%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="pf-badges-shelf">
            <h4 className="pf-badges-shelf-title">🏅 HUY HIỆU</h4>
            <div className="pf-badges-inline-header" style={{ marginTop: 0 }}>
              {ALL_BADGES.map((badge) => {
                const isUnlocked = earnedBadgeNames.includes(badge.name);
                return (
                  <div key={badge.name} className={`pf-badge-chip ${isUnlocked ? 'pf-badge-chip-unlocked' : 'pf-badge-chip-locked'}`} title={isUnlocked ? `✅ ${badge.desc}` : `🔒 ${badge.desc}`}>
                    <span className="pf-badge-chip-emoji">{badge.icon}</span>
                    <span>{badge.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bento Grid */}
          <div className="pf-bento-grid">
            <div className="pf-bento-card pf-bento-card-taste">
              <h3 className="pf-bento-card-title">🧬 Taste DNA</h3>
              <TasteDNA locations={locations} posts={posts} reviews={reviews} allLocations={allLocations} compact />
            </div>
            <div className="pf-bento-card pf-bento-card-timeline">
              <h3 className="pf-bento-card-title">🏅 Hành trình</h3>
              <MilestoneTimeline userData={userData} locations={locations} posts={posts} reviews={reviews} compact maxItems={3} />
            </div>
            {user && (
              <div className="pf-bento-card pf-bento-card-shared">
                <h3 className="pf-bento-card-title">🤝 Điểm chung</h3>
                {(() => {
                  const theirDna = computeTasteDNA(locations, posts, reviews, allLocations);
                  const theirVibeData = { tasteScores: theirDna.scores, reviews, allLocations, level: levelInfo.level };
                  return <SharedVibes myData={myVibeData} theirData={theirVibeData} theirName={displayName} />;
                })()}
              </div>
            )}
          </div>

          {/* Content Tabs */}
          <div className="pf-tabs">
            <button className={`pf-tab-btn ${activeTab === 'posts' ? 'active' : ''}`} onClick={() => setActiveTab('posts')}>
              📝 Bài viết <span className="pf-tab-count">{posts.length}</span>
            </button>
            <button className={`pf-tab-btn ${activeTab === 'locations' ? 'active' : ''}`} onClick={() => setActiveTab('locations')}>
              📍 Địa điểm <span className="pf-tab-count">{locations.length}</span>
            </button>
            <button className={`pf-tab-btn ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
              ⭐ Đánh giá <span className="pf-tab-count">{reviews.length}</span>
            </button>
          </div>

          <div className="pf-content-grid">
            {loadingContent ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : activeTab === 'posts' ? (
              posts.length === 0 ? (
                <div className="pf-empty-state">
                  <div className="pf-empty-icon">📝</div>
                  <div className="pf-empty-title">{displayName} chưa đăng bài viết nào</div>
                </div>
              ) : (
                posts.map(post => (
                  <div key={post.id} className="pf-card">
                    <div className="pf-card-header">
                      <h3 className="pf-card-title"><Link href={`/post/${post.id}`}>{post.title}</Link></h3>
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
                      <span>{post.createdAt ? (post.createdAt.toDate ? post.createdAt.toDate().toLocaleDateString('vi-VN') : new Date(post.createdAt).toLocaleDateString('vi-VN')) : '—'}</span>
                    </div>
                    <p className="pf-card-body">{post.content && post.content.length > 200 ? `${post.content.substring(0, 200)}...` : post.content}</p>
                    <div className="pf-card-footer">
                      <div className="pf-card-stats">
                        <span>👍 {post.likes || post.upvotes || 0} lượt thích</span>
                        <span>💬 {post.commentCount || 0} bình luận</span>
                      </div>
                      <div className="pf-card-actions">
                        <Link href={`/post/${post.id}`} className="pf-action-btn pf-action-btn-view">🔗 Xem</Link>
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : activeTab === 'locations' ? (
              locations.length === 0 ? (
                <div className="pf-empty-state">
                  <div className="pf-empty-icon">📍</div>
                  <div className="pf-empty-title">{displayName} chưa thêm địa điểm nào</div>
                </div>
              ) : (
                locations.map(loc => (
                  <div key={loc.id} className="pf-card">
                    <div className="pf-card-header">
                      <h3 className="pf-card-title"><Link href={`/location/${loc.id}`}>{loc.name}</Link></h3>
                    </div>
                    <div className="pf-card-meta">
                      <span className="pf-card-category">{loc.category}</span>
                      <span>•</span>
                      <span>{loc.address}</span>
                    </div>
                    <p className="pf-card-body">{loc.description && loc.description.length > 200 ? `${loc.description.substring(0, 200)}...` : loc.description}</p>
                    <div className="pf-card-footer">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <RatingStars rating={loc.averageRating || 0} />
                        <span style={{ fontSize: '0.82rem', color: '#8e8e8e' }}>({loc.reviewCount || 0} đánh giá)</span>
                      </div>
                      <div className="pf-card-actions">
                        <Link href={`/location/${loc.id}`} className="pf-action-btn pf-action-btn-view">🔗 Xem</Link>
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              reviews.length === 0 ? (
                <div className="pf-empty-state">
                  <div className="pf-empty-icon">⭐</div>
                  <div className="pf-empty-title">{displayName} chưa viết đánh giá nào</div>
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
                      &quot;{rev.comment}&quot;
                    </p>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
