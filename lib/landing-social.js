import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from './firebase';

/**
 * ═══════════════════════════════════════════════════════════
 * LANDING PAGE SOCIAL PROOF — CityZ Kit
 * ═══════════════════════════════════════════════════════════
 * 
 * Fetch public data for landing page (no auth required)
 */

/**
 * Lấy thống kê cộng đồng: tổng users, posts, locations
 */
export async function getCommunityStats() {
  try {
    const [usersSnap, postsSnap, locationsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'posts')),
      getDocs(collection(db, 'locations')),
    ]);
    
    return {
      userCount: usersSnap.size,
      postCount: postsSnap.docs.filter(d => {
        const s = d.data().status;
        return s === 'approved' || !s;
      }).length,
      locationCount: locationsSnap.docs.filter(d => {
        const s = d.data().status;
        return s === 'approved' || !s;
      }).length,
    };
  } catch (error) {
    console.error('Error fetching community stats:', error);
    return { userCount: 0, postCount: 0, locationCount: 0 };
  }
}

/**
 * Lấy avatar + tên của users gần đây nhất
 */
export async function getRecentUsers(limitCount = 10) {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const users = snapshot.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.name && u.avatarUrl)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, limitCount);
    
    return users.map(u => ({
      uid: u.uid,
      name: u.name,
      avatarUrl: u.avatarUrl,
    }));
  } catch (error) {
    console.error('Error fetching recent users:', error);
    return [];
  }
}

/**
 * Lấy các hoạt động gần đây dạng "X vừa làm Y"
 * Kết hợp posts + reviews mới nhất
 */
export async function getRecentActivities(limitCount = 5) {
  try {
    const activities = [];
    
    // Recent approved posts
    const postsSnap = await getDocs(collection(db, 'posts'));
    const posts = postsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => (p.status === 'approved' || !p.status) && !p.isAnonymous)
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      })
      .slice(0, 5);
    
    posts.forEach(p => {
      const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
      activities.push({
        type: 'post',
        userName: p.authorName || 'Ai đó',
        userAvatar: p.authorAvatar || null,
        action: 'đã chia sẻ',
        target: p.title?.substring(0, 40) + (p.title?.length > 40 ? '...' : ''),
        emoji: '📝',
        createdAt,
        linkUrl: `/post/${p.id}`,
      });
    });
    
    // Recent reviews
    const reviewsSnap = await getDocs(collection(db, 'reviews'));
    const reviews = reviewsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);
    
    reviews.forEach(r => {
      activities.push({
        type: 'review',
        userName: r.userName || 'Ai đó',
        userAvatar: null,
        action: `đã đánh giá ${r.rating}⭐`,
        target: '',
        emoji: '⭐',
        createdAt: new Date(r.createdAt || 0),
        linkUrl: r.locationId ? `/location/${r.locationId}` : null,
      });
    });
    
    // Sort all by time, take top N
    activities.sort((a, b) => b.createdAt - a.createdAt);
    return activities.slice(0, limitCount);
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return [];
  }
}

/**
 * Lấy bài viết trending (public, no auth)
 */
export async function getTrendingPostsPublic(limitCount = 3) {
  try {
    const postsSnap = await getDocs(collection(db, 'posts'));
    const posts = postsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => (p.status === 'approved' || !p.status) && !p.isAnonymous);
    
    // Sort by engagement
    posts.sort((a, b) => {
      const scoreA = (a.likes || a.upvotes || 0) * 3 + (a.commentCount || 0) * 5 + (a.shares || 0) * 7;
      const scoreB = (b.likes || b.upvotes || 0) * 3 + (b.commentCount || 0) * 5 + (b.shares || 0) * 7;
      return scoreB - scoreA;
    });
    
    return posts.slice(0, limitCount).map(p => ({
      id: p.id,
      title: p.title,
      content: p.content?.substring(0, 120) + (p.content?.length > 120 ? '...' : ''),
      authorName: p.authorName,
      authorAvatar: p.authorAvatar,
      likes: p.likes || p.upvotes || 0,
      commentCount: p.commentCount || 0,
      category: p.category,
      createdAt: p.createdAt,
    }));
  } catch (error) {
    console.error('Error fetching trending posts:', error);
    return [];
  }
}

/**
 * Helper: format thời gian "X phút trước"
 */
export function timeAgoShort(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return d.toLocaleDateString('vi-VN');
}
