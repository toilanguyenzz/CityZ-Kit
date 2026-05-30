// Force HMR reload of firestore modules
import { collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { compressAndToBase64 } from './imageHelper';
import { db } from './firebase';

export async function getUserStats(userId) {
  const locationsQuery = query(collection(db, 'locations'), where('createdBy', '==', userId));
  const locationsSnap = await getDocs(locationsQuery);
  const locationCount = locationsSnap.size;

  const reviewsQuery = query(collection(db, 'reviews'), where('userId', '==', userId));
  const reviewsSnap = await getDocs(reviewsQuery);
  const reviewCount = reviewsSnap.size;

  const postsQuery = query(collection(db, 'posts'), where('userId', '==', userId));
  const postsSnap = await getDocs(postsQuery);
  const postCount = postsSnap.size;

  // Calculate total upvotes received on all posts
  let totalUpvotes = 0;
  postsSnap.docs.forEach(d => {
    totalUpvotes += d.data().upvotes || 0;
  });

  return { locationCount, reviewCount, postCount, totalUpvotes };
}

const LEVELS = [
  { level: 1, name: 'Tân binh', icon: '🌱', xpRequired: 0, color: '#94a3b8' },
  { level: 2, name: 'Thành viên', icon: '🌿', xpRequired: 100, color: '#22c55e' },
  { level: 3, name: 'Người đóng góp', icon: '🌳', xpRequired: 300, color: '#3b82f6' },
  { level: 4, name: 'Chuyên gia', icon: '⭐', xpRequired: 600, color: '#f59e0b' },
  { level: 5, name: 'Huyền thoại', icon: '👑', xpRequired: 1000, color: '#ef4444' },
];

export function calculateXPFromStats(stats) {
  return (stats.locationCount * 50) + (stats.postCount * 30) + (stats.reviewCount * 20) + (stats.totalUpvotes * 5);
}

export function getLevelFromXP(xp) {
  let currentLevel = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.xpRequired) {
      currentLevel = lvl;
    } else {
      break;
    }
  }
  const nextLevel = LEVELS.find(l => l.level === currentLevel.level + 1) || null;
  const xpForCurrentLevel = currentLevel.xpRequired;
  const xpForNextLevel = nextLevel ? nextLevel.xpRequired : currentLevel.xpRequired;
  const xpInLevel = xp - xpForCurrentLevel;
  const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
  const progress = nextLevel ? Math.min((xpInLevel / xpNeededForNext) * 100, 100) : 100;

  return {
    ...currentLevel,
    xp,
    nextLevel,
    xpToNext: nextLevel ? xpForNextLevel - xp : 0,
    progress,
  };
}

export { LEVELS };

async function checkAndAwardBadges(userId) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;
  const userData = userSnap.data();
  const currentBadges = userData.badges || [];
  const badgeNames = currentBadges.map(b => b.name);

  const { locationCount, reviewCount, postCount } = await getUserStats(userId);
  const newBadges = [];

  if (locationCount >= 1 && !badgeNames.includes('Explorer')) {
    newBadges.push({ name: 'Explorer', icon: '🧭', earnedAt: new Date().toISOString() });
  }
  if (reviewCount >= 3 && !badgeNames.includes('Helper')) {
    newBadges.push({ name: 'Helper', icon: '🤝', earnedAt: new Date().toISOString() });
  }
  if (postCount >= 1 && !badgeNames.includes('Influencer')) {
    newBadges.push({ name: 'Influencer', icon: '⭐', earnedAt: new Date().toISOString() });
  }
  if (locationCount >= 5 && !badgeNames.includes('Trailblazer')) {
    newBadges.push({ name: 'Trailblazer', icon: '🗺️', earnedAt: new Date().toISOString() });
  }
  if (reviewCount >= 10 && !badgeNames.includes('Critic')) {
    newBadges.push({ name: 'Critic', icon: '📝', earnedAt: new Date().toISOString() });
  }
  if (postCount >= 5 && !badgeNames.includes('Blogger')) {
    newBadges.push({ name: 'Blogger', icon: '📰', earnedAt: new Date().toISOString() });
  }

  if (newBadges.length > 0) {
    await updateDoc(userRef, { badges: [...currentBadges, ...newBadges] });
  }
}

// ─── Profile Management ─────────────────────────────────
export async function updateUserProfile(userId, data) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateUserAvatar(userId, avatarBase64) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    avatarUrl: avatarBase64,
    updatedAt: new Date().toISOString(),
  });
}

export async function getUserProfile(userId) {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  return null;
}

export async function addLocation(locationData, imageFile, userId, userRole = 'user', media = []) {
  let imageUrl = null;
  if (imageFile) {
    try {
      imageUrl = await compressAndToBase64(imageFile);
    } catch (error) {
      console.error('Error compressing image:', error);
      throw new Error('Không thể xử lý hình ảnh: ' + error.message);
    }
  }
  const location = {
    ...locationData,
    imageUrl: imageUrl || (media && media.length > 0 ? media[0].url : null),
    media: media || [],
    videoUrl: locationData.videoUrl || null,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    reviews: [],
    reviewCount: 0,
    averageRating: 0,
    status: userRole?.trim() === 'admin' ? 'approved' : 'pending',
  };
  const docRef = await addDoc(collection(db, 'locations'), location);
  await checkAndAwardBadges(userId);
  return docRef.id;
}

export async function getLocationById(locationId) {
  const docRef = doc(db, 'locations', locationId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

export async function addReview(locationId, userId, userName, rating, comment) {
  const review = {
    locationId,
    userId,
    userName,
    rating,
    comment,
    createdAt: new Date().toISOString(),
  };
  const reviewRef = await addDoc(collection(db, 'reviews'), review);

  const locationRef = doc(db, 'locations', locationId);
  const locationSnap = await getDoc(locationRef);
  const location = locationSnap.data();
  const existingReviews = location.reviews || [];
  const updatedReviews = [...existingReviews, { id: reviewRef.id, ...review }];
  const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = totalRating / updatedReviews.length;
  await updateDoc(locationRef, {
    reviews: updatedReviews,
    reviewCount: updatedReviews.length,
    averageRating: avgRating,
  });

  await checkAndAwardBadges(userId);
  return reviewRef.id;
}

export async function addPost(userId, authorName, title, content, imageUrl = null, userRole = 'user', type = 'discussion', category = 'general', flair = null, isAnonymous = false, authorAvatar = null, authorBadges = [], media = [], locationId = null, locationName = null) {
  const hashtagRegex = /#(\w+)/g;
  const tags = [];
  let match;
  while ((match = hashtagRegex.exec(content)) !== null) {
    tags.push(match[1].toLowerCase());
  }

  const post = {
    userId, // Always store real userId for admin visibility
    authorName: isAnonymous ? 'Ẩn danh' : authorName,
    realAuthorName: authorName, // Admin can always see this
    authorAvatar: isAnonymous ? null : (authorAvatar || null),
    authorBadges: isAnonymous ? [] : (authorBadges || []),
    isAnonymous: isAnonymous || false,
    title,
    content,
    imageUrl: imageUrl || (media && media.length > 0 ? media[0].url : null),
    media: media || [],
    tags,
    type,
    category,
    flair,
    upvotes: 0,
    upvotedBy: [],
    downvotes: 0,
    downvotedBy: [],
    commentCount: 0,
    viewCount: 0,
    isPinned: false,
    isLocked: false,
    bestAnswerId: null,
    locationId: locationId || null,
    locationName: locationName || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: userRole?.trim() === 'admin' ? 'approved' : 'pending',
  };
  const docRef = await addDoc(collection(db, 'posts'), post);
  await checkAndAwardBadges(userId);
  return docRef.id;
}

/**
 * Vote on a poll option
 */
export async function votePoll(postId, optionIndex, userId) {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) throw new Error('Không tìm thấy bài viết');

  const post = postSnap.data();
  const options = [...(post.pollData?.options || [])];

  if (options[optionIndex]) {
    options[optionIndex].votes = (options[optionIndex].votes || 0) + 1;
    await updateDoc(postRef, { pollData: { ...post.pollData, options } });
  }
}

/**
 * Get posts by category
 */
export async function getPostsByCategory(category) {
  return getPosts('hot', category);
}

/**
 * Upvote a post
 */
export async function upvotePost(postId, userId) {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) throw new Error('Không tìm thấy bài viết');

  const post = postSnap.data();
  const hasUpvoted = post.upvotedBy?.includes(userId);
  const hasDownvoted = post.downvotedBy?.includes(userId);

  let updates = {};

  if (hasUpvoted) {
    // Remove upvote
    updates = {
      upvotes: increment(-1),
      upvotedBy: arrayRemove(userId)
    };
  } else {
    // Add upvote (and remove downvote if exists)
    updates = {
      upvotes: increment(1),
      upvotedBy: arrayUnion(userId)
    };
    if (hasDownvoted) {
      updates.downvotes = increment(-1);
      updates.downvotedBy = arrayRemove(userId);
    }
  }

  await updateDoc(postRef, updates);
  return !hasUpvoted; // Returns true if newly upvoted
}

/**
 * Downvote a post
 */
export async function downvotePost(postId, userId) {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) throw new Error('Không tìm thấy bài viết');

  const post = postSnap.data();
  const hasDownvoted = post.downvotedBy?.includes(userId);
  const hasUpvoted = post.upvotedBy?.includes(userId);

  let updates = {};

  if (hasDownvoted) {
    // Remove downvote
    updates = {
      downvotes: increment(-1),
      downvotedBy: arrayRemove(userId)
    };
  } else {
    // Add downvote (and remove upvote if exists)
    updates = {
      downvotes: increment(1),
      downvotedBy: arrayUnion(userId)
    };
    if (hasUpvoted) {
      updates.upvotes = increment(-1);
      updates.upvotedBy = arrayRemove(userId);
    }
  }

  await updateDoc(postRef, updates);
  return !hasDownvoted; // Returns true if newly downvoted
}

/**
 * Increment view count for a post
 */
export async function incrementViewCount(postId) {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    viewCount: increment(1)
  });
}

/**
 * Pin a post (admin only)
 */
export async function pinPost(postId) {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    isPinned: true,
    updatedAt: serverTimestamp()
  });
}

/**
 * Unpin a post (admin only)
 */
export async function unpinPost(postId) {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    isPinned: false,
    updatedAt: serverTimestamp()
  });
}

/**
 * Mark a comment as the best answer (for question threads)
 */
export async function markAsBestAnswer(postId, commentId) {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    bestAnswerId: commentId,
    updatedAt: serverTimestamp()
  });
}

/**
 * Get posts with sorting options
 * @param {'hot'|'new'|'top'|'controversial'} sortBy
 * @param {string} category - Filter by category
 * @param {number} limit - Max posts to return
 */
export async function getPosts(sortBy = 'hot', category = null, limitCount = 50) {
  // Use a simple query to avoid requiring composite indexes
  const snapshot = await getDocs(collection(db, 'posts'));
  let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Filter only approved posts (also include posts without status for backwards compatibility)
  posts = posts.filter(p => p.status === 'approved' || !p.status);

  // Filter by category if provided
  if (category) {
    posts = posts.filter(p => p.category === category);
  }

  // Apply sorting client-side
  switch (sortBy) {
    case 'new':
      posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case 'top':
      posts.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
      break;
    case 'controversial':
      posts.sort((a, b) => (b.downvotes || 0) - (a.downvotes || 0));
      break;
    case 'hot':
    default:
      posts.sort((a, b) => {
        // Social media hot score: engagement weighted by recency
        const getHotScore = (p) => {
          const likes = p.likes || p.upvotes || 0;
          const comments = p.commentCount || 0;
          const shares = p.shares || 0;
          const views = p.viewCount || 0;
          const engagement = (likes * 3) + (comments * 5) + (shares * 7) + (views * 0.1);
          
          // Time decay: posts lose ranking power over time
          const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
          const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
          const decay = Math.pow(hoursAgo + 2, 1.5);
          
          return engagement / decay;
        };
        return getHotScore(b) - getHotScore(a);
      });
      break;

  }

  return posts.slice(0, limitCount);
}

/**
 * Get pinned posts (admin-only feature)
 */
export async function getPinnedPosts() {
  const q = query(
    collection(db, 'posts'),
    where('isPinned', '==', true),
    where('status', '==', 'approved'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getPostsByTag(tag) {
  const q = query(
    collection(db, 'posts'),
    where('tags', 'array-contains', tag.toLowerCase())
  );
  const snapshot = await getDocs(q);
  const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getPostById(postId) {
  const docRef = doc(db, 'posts', postId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;

  const post = { id: docSnap.id, ...docSnap.data() };

  // Fetch nested comments with their replies
  if (post.commentCount > 0) {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const commentsSnap = await getDocs(commentsRef);
    const comments = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Organize into nested structure
    const commentMap = {};
    const rootComments = [];

    comments.forEach(comment => {
      commentMap[comment.id] = { ...comment, replies: [] };
      if (comment.parentId && commentMap[comment.parentId]) {
        commentMap[comment.parentId].replies.push(commentMap[comment.id]);
      } else {
        rootComments.push(commentMap[comment.id]);
      }
    });

    // Sort root comments by createdAt (newest first by default)
    rootComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    post.comments = rootComments;
  }

  return post;
}

export async function addCommentToPost(postId, userId, userName, comment, parentId = null, userAvatar = null) {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) throw new Error('Không tìm thấy bài viết');

  // Determine depth for nested comments
  let depth = 0;
  if (parentId) {
    // For MVP, we'll assume parentId is a root comment for simplicity
    depth = 1;
  }

  const newComment = {
    userId,
    userName,
    userAvatar: userAvatar || null,
    comment,
    parentId,
    depth,
    upvotes: 0,
    upvotedBy: [],
    downvotes: 0,
    downvotedBy: [],
    createdAt: serverTimestamp(),
  };

  // Add to subcollection
  const commentsRef = collection(db, 'posts', postId, 'comments');
  await addDoc(commentsRef, newComment);

  // Update post metadata
  await updateDoc(postRef, {
    commentCount: increment(1)
  });

  return newComment;
}

/**
 * Upvote a comment
 */
export async function upvoteComment(postId, commentId, userId) {
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  const commentSnap = await getDoc(commentRef);
  if (!commentSnap.exists()) throw new Error('Không tìm thấy bình luận');

  const comment = commentSnap.data();
  const hasUpvoted = comment.upvotedBy?.includes(userId);
  const hasDownvoted = comment.downvotedBy?.includes(userId);

  let updates = {};

  if (hasUpvoted) {
    updates = {
      upvotes: increment(-1),
      upvotedBy: arrayRemove(userId)
    };
  } else {
    updates = {
      upvotes: increment(1),
      upvotedBy: arrayUnion(userId)
    };
    if (hasDownvoted) {
      updates.downvotes = increment(-1);
      updates.downvotedBy = arrayRemove(userId);
    }
  }

  await updateDoc(commentRef, updates);
  return !hasUpvoted;
}

/**
 * Downvote a comment
 */
export async function downvoteComment(postId, commentId, userId) {
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  const commentSnap = await getDoc(commentRef);
  if (!commentSnap.exists()) throw new Error('Không tìm thấy bình luận');

  const comment = commentSnap.data();
  const hasDownvoted = comment.downvotedBy?.includes(userId);
  const hasUpvoted = comment.upvotedBy?.includes(userId);

  let updates = {};

  if (hasDownvoted) {
    updates = {
      downvotes: increment(-1),
      downvotedBy: arrayRemove(userId)
    };
  } else {
    updates = {
      downvotes: increment(1),
      downvotedBy: arrayUnion(userId)
    };
    if (hasUpvoted) {
      updates.upvotes = increment(-1);
      updates.upvotedBy = arrayRemove(userId);
    }
  }

  await updateDoc(commentRef, updates);
  return !hasDownvoted;
}

export async function seedInitialLocations() {
  const locationsRef = collection(db, 'locations');
  const snapshot = await getDocs(locationsRef);
  if (!snapshot.empty) return;

  const sampleLocations = [
    { name: 'Cơm tấm Ba Ghiền', category: 'Food', address: 'Q1, HCM', description: 'Cơm tấm ngon nổi tiếng', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/placeholder.appspot.com/o/food1.jpg?alt=media', reviewCount: 5, averageRating: 4.5 },
    { name: 'Phòng trọ Nguyễn Trãi', category: 'Housing', address: 'Q5, HCM', description: 'Phòng sạch sẽ, an ninh', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/placeholder.appspot.com/o/housing1.jpg?alt=media', reviewCount: 3, averageRating: 4.0 },
    { name: 'Cafe The Coffee House', category: 'Cafe', address: 'Nhiều chi nhánh', description: 'Không gian đẹp, wifi mạnh', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/placeholder.appspot.com/o/cafe1.jpg?alt=media', reviewCount: 8, averageRating: 4.7 },
  ];
  for (const loc of sampleLocations) {
    await addDoc(locationsRef, { ...loc, createdAt: new Date().toISOString(), reviews: [], status: 'approved' });
  }
}

// ═══════════════════════════════════════════════════════════
// MODERATION — Admin functions
// ═══════════════════════════════════════════════════════════

/**
 * Lấy danh sách địa điểm đang chờ duyệt
 */
export async function getPendingLocations() {
  const q = query(
    collection(db, 'locations'),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  const locations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return locations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Lấy danh sách bài viết đang chờ duyệt
 */
export async function getPendingPosts() {
  const q = query(
    collection(db, 'posts'),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Duyệt hoặc từ chối nội dung
 * @param {'locations'|'posts'} collectionName
 * @param {string} docId
 * @param {'approved'|'rejected'} newStatus
 */
export async function moderateItem(collectionName, docId, newStatus) {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, { status: newStatus });
}

// ─── Edit & Delete Operations ─────────────────────────────

export async function updatePost(postId, data) {
  const docRef = doc(db, 'posts', postId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePost(postId) {
  // Cascade delete all comments in the subcollection
  const commentsRef = collection(db, 'posts', postId, 'comments');
  const commentsSnap = await getDocs(commentsRef);
  for (const commentDoc of commentsSnap.docs) {
    await deleteDoc(commentDoc.ref);
  }

  const docRef = doc(db, 'posts', postId);
  await deleteDoc(docRef);
}

export async function updateMarketplaceItem(itemId, data) {
  const docRef = doc(db, 'marketplaceItems', itemId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMarketplaceItem(itemId) {
  const docRef = doc(db, 'marketplaceItems', itemId);
  await deleteDoc(docRef);
}

export async function updateBuddyRequest(requestId, data) {
  const docRef = doc(db, 'buddyRequests', requestId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBuddyRequest(requestId) {
  const docRef = doc(db, 'buddyRequests', requestId);
  await deleteDoc(docRef);
}

export async function updateWarningZone(zoneId, data) {
  const docRef = doc(db, 'warningZones', zoneId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteWarningZone(zoneId) {
  const docRef = doc(db, 'warningZones', zoneId);
  await deleteDoc(docRef);
}

export async function updateLocation(locationId, data) {
  const docRef = doc(db, 'locations', locationId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteLocation(locationId) {
  // Cascade delete all reviews from the reviews collection
  const reviewsQuery = query(collection(db, 'reviews'), where('locationId', '==', locationId));
  const reviewsSnap = await getDocs(reviewsQuery);
  for (const reviewDoc of reviewsSnap.docs) {
    await deleteDoc(reviewDoc.ref);
  }

  const docRef = doc(db, 'locations', locationId);
  await deleteDoc(docRef);
}

export async function deleteComment(postId, commentId) {
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  const commentSnap = await getDoc(commentRef);
  if (!commentSnap.exists()) throw new Error('Không tìm thấy bình luận');

  const commentsRef = collection(db, 'posts', postId, 'comments');
  const repliesQuery = query(commentsRef, where('parentId', '==', commentId));
  const repliesSnap = await getDocs(repliesQuery);
  
  let deletedCount = 1;
  await deleteDoc(commentRef);

  for (const replyDoc of repliesSnap.docs) {
    await deleteDoc(replyDoc.ref);
    deletedCount += 1;
    
    // Check if the reply itself has replies and delete them
    const subRepliesQuery = query(commentsRef, where('parentId', '==', replyDoc.id));
    const subRepliesSnap = await getDocs(subRepliesQuery);
    for (const subReplyDoc of subRepliesSnap.docs) {
      await deleteDoc(subReplyDoc.ref);
      deletedCount += 1;
    }
  }

  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    commentCount: increment(-deletedCount)
  });
}

export async function reactToComment(postId, commentId, userId, reactionType) {
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  const commentSnap = await getDoc(commentRef);
  if (!commentSnap.exists()) throw new Error('Không tìm thấy bình luận');

  const commentData = commentSnap.data();
  const reactions = commentData.reactions || {};
  
  if (!reactions[reactionType]) {
    reactions[reactionType] = [];
  }

  const userIndex = reactions[reactionType].indexOf(userId);
  if (userIndex > -1) {
    reactions[reactionType].splice(userIndex, 1);
  } else {
    reactions[reactionType].push(userId);
  }

  await updateDoc(commentRef, { reactions });
  return reactions;
}

export async function deleteReview(locationId, reviewId) {
  const reviewRef = doc(db, 'reviews', reviewId);
  await deleteDoc(reviewRef);

  const locationRef = doc(db, 'locations', locationId);
  const locationSnap = await getDoc(locationRef);
  if (!locationSnap.exists()) throw new Error('Không tìm thấy địa điểm');

  const location = locationSnap.data();
  const existingReviews = location.reviews || [];
  const updatedReviews = existingReviews.filter(r => r.id !== reviewId);

  const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = updatedReviews.length > 0 ? (totalRating / updatedReviews.length) : 0;

  await updateDoc(locationRef, {
    reviews: updatedReviews,
    reviewCount: updatedReviews.length,
    averageRating: avgRating,
  });
}

export async function updateReview(locationId, reviewId, updatedReviewData) {
  const reviewRef = doc(db, 'reviews', reviewId);
  await updateDoc(reviewRef, updatedReviewData);

  const locationRef = doc(db, 'locations', locationId);
  const locationSnap = await getDoc(locationRef);
  if (!locationSnap.exists()) throw new Error('Không tìm thấy địa điểm');

  const location = locationSnap.data();
  const existingReviews = location.reviews || [];
  
  const updatedReviews = existingReviews.map(r => {
    if (r.id === reviewId) {
      return {
        ...r,
        ...updatedReviewData
      };
    }
    return r;
  });

  const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = updatedReviews.length > 0 ? (totalRating / updatedReviews.length) : 0;

  await updateDoc(locationRef, {
    reviews: updatedReviews,
    reviewCount: updatedReviews.length,
    averageRating: avgRating,
  });
}

export async function reactToReview(locationId, reviewId, userId, reactionType) {
  const reviewRef = doc(db, 'reviews', reviewId);
  const reviewSnap = await getDoc(reviewRef);
  
  if (reviewSnap.exists()) {
    const reviewData = reviewSnap.data();
    const reactions = reviewData.reactions || {};
    if (!reactions[reactionType]) {
      reactions[reactionType] = [];
    }
    const userIndex = reactions[reactionType].indexOf(userId);
    if (userIndex > -1) {
      reactions[reactionType].splice(userIndex, 1);
    } else {
      reactions[reactionType].push(userId);
    }
    await updateDoc(reviewRef, { reactions });
  }

  const locationRef = doc(db, 'locations', locationId);
  const locationSnap = await getDoc(locationRef);
  if (locationSnap.exists()) {
    const location = locationSnap.data();
    const existingReviews = location.reviews || [];
    const updatedReviews = existingReviews.map(r => {
      if (r.id === reviewId) {
        const reactions = r.reactions || {};
        if (!reactions[reactionType]) {
          reactions[reactionType] = [];
        }
        const userIndex = reactions[reactionType].indexOf(userId);
        if (userIndex > -1) {
          reactions[reactionType].splice(userIndex, 1);
        } else {
          reactions[reactionType].push(userId);
        }
        return { ...r, reactions };
      }
      return r;
    });

    await updateDoc(locationRef, { reviews: updatedReviews });
  }
}

// ═══════════════════════════════════════════════════════════
// SOCIAL MEDIA INTERACTIONS — Like, Bookmark, Share, Trending
// ═══════════════════════════════════════════════════════════

/**
 * Like/Unlike a post (toggle) — Twitter/Instagram style
 */
export async function likePost(postId, userId) {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) throw new Error('Không tìm thấy bài viết');

  const post = postSnap.data();
  const hasLiked = post.likedBy?.includes(userId);

  if (hasLiked) {
    await updateDoc(postRef, {
      likes: increment(-1),
      likedBy: arrayRemove(userId)
    });
  } else {
    await updateDoc(postRef, {
      likes: increment(1),
      likedBy: arrayUnion(userId)
    });
  }
  return !hasLiked;
}

/**
 * Bookmark/Unbookmark a post (toggle) — Instagram/Twitter style
 */
export async function bookmarkPost(postId, userId) {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) throw new Error('Không tìm thấy bài viết');

  const post = postSnap.data();
  const hasBookmarked = post.bookmarkedBy?.includes(userId);

  if (hasBookmarked) {
    await updateDoc(postRef, {
      bookmarks: increment(-1),
      bookmarkedBy: arrayRemove(userId)
    });
  } else {
    await updateDoc(postRef, {
      bookmarks: increment(1),
      bookmarkedBy: arrayUnion(userId)
    });
  }
  return !hasBookmarked;
}

/**
 * Get bookmarked posts for a user
 */
export async function getBookmarkedPosts(userId) {
  const snapshot = await getDocs(collection(db, 'posts'));
  let posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  posts = posts.filter(p => p.bookmarkedBy?.includes(userId));
  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return posts;
}

/**
 * Track share count for a post
 */
export async function sharePost(postId) {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    shares: increment(1)
  });
}

/**
 * Get trending tags from recent posts (last 7 days)
 */
export async function getTrendingTags(limitCount = 5) {
  const snapshot = await getDocs(collection(db, 'posts'));
  const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  // Filter approved posts
  const approvedPosts = posts.filter(p => p.status === 'approved' || !p.status);

  // Count tags across all posts with engagement weighting
  const tagCounts = {};
  approvedPosts.forEach(post => {
    const tags = post.tags || [];
    const engagement = (post.likes || post.upvotes || 0) + (post.commentCount || 0) * 2 + (post.shares || 0) * 3;
    tags.forEach(tag => {
      if (!tagCounts[tag]) {
        tagCounts[tag] = { tag, count: 0, postCount: 0, engagement: 0 };
      }
      tagCounts[tag].count += 1 + engagement;
      tagCounts[tag].postCount += 1;
      tagCounts[tag].engagement += engagement;
    });
  });

  return Object.values(tagCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limitCount);
}

/**
 * Get approved posts that reference a specific locationId
 */
export async function getPostsByLocationId(locationId) {
  const snapshot = await getDocs(collection(db, 'posts'));
  let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Filter only approved posts referencing the location
  posts = posts.filter(p => (p.status === 'approved' || !p.status) && p.locationId === locationId);

  // Sort by newest first
  posts.sort((a, b) => {
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
    return dateB - dateA;
  });

  return posts;
}

export async function getUserPosts(userId) {
  const q = query(collection(db, 'posts'), where('userId', '==', userId));
  const snap = await getDocs(q);
  const posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  posts.sort((a, b) => {
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
    return dateB - dateA;
  });
  return posts;
}

export async function getUserLocations(userId) {
  const q = query(collection(db, 'locations'), where('createdBy', '==', userId));
  const snap = await getDocs(q);
  const locations = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  locations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return locations;
}

export async function getUserReviews(userId) {
  const q = query(collection(db, 'reviews'), where('userId', '==', userId));
  const snap = await getDocs(q);
  const reviews = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  const reviewsWithLocation = await Promise.all(reviews.map(async (r) => {
    let locationName = 'Địa điểm đã bị ẩn hoặc xóa';
    if (r.locationId) {
      try {
        const locRef = doc(db, 'locations', r.locationId);
        const locSnap = await getDoc(locRef);
        if (locSnap.exists()) {
          locationName = locSnap.data().name;
        }
      } catch (e) {
        console.error('Error fetching location name for review:', e);
      }
    }
    return { ...r, locationName };
  }));

  reviewsWithLocation.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return reviewsWithLocation;
}

export async function bookmarkLocation(locationId, userId) {
  const locRef = doc(db, 'locations', locationId);
  const locSnap = await getDoc(locRef);
  if (!locSnap.exists()) throw new Error('Không tìm thấy địa điểm');

  const location = locSnap.data();
  const hasBookmarked = location.bookmarkedBy?.includes(userId);

  if (hasBookmarked) {
    await updateDoc(locRef, {
      bookmarkedBy: arrayRemove(userId)
    });
  } else {
    await updateDoc(locRef, {
      bookmarkedBy: arrayUnion(userId)
    });
  }
  return !hasBookmarked;
}

export async function getBookmarkedLocations(userId) {
  const snapshot = await getDocs(collection(db, 'locations'));
  let locations = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  locations = locations.filter(l => l.bookmarkedBy?.includes(userId));
  locations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return locations;
}

// ═══════════════════════════════════════════════════════════
// PROFILE PERSONALIZATION — TasteDNA, SharedVibes, Insights
// ═══════════════════════════════════════════════════════════

const TASTE_CATEGORIES = [
  { key: 'food', label: 'Ẩm thực', icon: '🍜', locationCat: 'Food', postCat: 'food' },
  { key: 'cafe', label: 'Cafe', icon: '☕', locationCat: 'Cafe', postCat: null },
  { key: 'housing', label: 'Nhà trọ', icon: '🏠', locationCat: 'Housing', postCat: 'housing' },
  { key: 'play', label: 'Giải trí', icon: '🎡', locationCat: 'Play', postCat: 'social' },
  { key: 'other', label: 'Khác', icon: '📌', locationCat: 'Other', postCat: 'general' },
];

export { TASTE_CATEGORIES };

/**
 * Compute Taste DNA from user's locations, posts, reviews
 * Returns { scores: { food: 0.6, cafe: 0.2, ... }, topTaste, personalityTitle }
 */
export function computeTasteDNA(locations, posts, reviews, allLocations) {
  const counts = {};
  TASTE_CATEGORIES.forEach(c => { counts[c.key] = 0; });

  // Count locations by category
  locations.forEach(loc => {
    const cat = TASTE_CATEGORIES.find(c => c.locationCat === loc.category);
    if (cat) counts[cat.key] += 2; // weight: 2 for creating a location
    else counts['other'] += 2;
  });

  // Count posts by category
  posts.forEach(post => {
    const cat = TASTE_CATEGORIES.find(c => c.postCat === post.category);
    if (cat) counts[cat.key] += 1;
    else counts['other'] += 1;
  });

  // Count reviews — map back to location category
  reviews.forEach(rev => {
    if (rev.locationId) {
      const loc = allLocations.find(l => l.id === rev.locationId);
      if (loc) {
        const cat = TASTE_CATEGORIES.find(c => c.locationCat === loc.category);
        if (cat) counts[cat.key] += 1.5; // weight: 1.5 for reviewing
        else counts['other'] += 1.5;
      }
    }
  });

  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const scores = {};
  TASTE_CATEGORIES.forEach(c => {
    scores[c.key] = total > 0 ? counts[c.key] / total : 0;
  });

  // Find dominant taste
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const topTaste = sorted[0]?.[0] || 'other';
  const topScore = sorted[0]?.[1] || 0;

  // Generate personality title
  let personalityTitle = '🌟 Nhà Khám phá Toàn diện';
  if (total === 0) {
    personalityTitle = '🌱 Người mới bắt đầu';
  } else if (topScore >= 0.5) {
    const cat = TASTE_CATEGORIES.find(c => c.key === topTaste);
    const titles = {
      food: '🍜 Tín đồ Ẩm thực',
      cafe: '☕ Nghiện Cafe',
      housing: '🏠 Chuyên gia Nhà trọ',
      play: '🎡 Dân Phiêu lưu',
      other: '📌 Nhà Đa năng',
    };
    personalityTitle = titles[topTaste] || personalityTitle;
  } else if (topScore >= 0.35) {
    const cat = TASTE_CATEGORIES.find(c => c.key === topTaste);
    const titles = {
      food: '🍜 Mê Ẩm thực',
      cafe: '☕ Fan Cafe',
      housing: '🏠 Thích Nhà trọ',
      play: '🎡 Ham Vui chơi',
      other: '📌 Đa dạng',
    };
    personalityTitle = titles[topTaste] || personalityTitle;
  }

  // Top 3 taste tags
  const tasteTags = sorted.slice(0, 3).filter(([, v]) => v > 0).map(([key]) => {
    const cat = TASTE_CATEGORIES.find(c => c.key === key);
    return cat ? { key, label: cat.label, icon: cat.icon, score: scores[key] } : null;
  }).filter(Boolean);

  return { scores, topTaste, personalityTitle, tasteTags, total };
}

/**
 * Compute shared vibes between two users
 */
export function computeSharedVibes(myData, theirData) {
  const vibes = [];

  // 1. Shared taste categories (top 2 of each)
  const myTop = Object.entries(myData.tasteScores || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
  const theirTop = Object.entries(theirData.tasteScores || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
  const sharedTastes = myTop.filter(t => theirTop.includes(t));
  sharedTastes.forEach(taste => {
    const cat = TASTE_CATEGORIES.find(c => c.key === taste);
    if (cat) vibes.push({ type: 'taste', icon: cat.icon, text: `Cùng mê ${cat.label}` });
  });

  // 2. Shared reviewed locations
  const myReviewedLocIds = new Set((myData.reviews || []).map(r => r.locationId).filter(Boolean));
  const theirReviewedLocIds = (theirData.reviews || []).map(r => r.locationId).filter(Boolean);
  const sharedLocIds = theirReviewedLocIds.filter(id => myReviewedLocIds.has(id));
  const uniqueSharedLocs = [...new Set(sharedLocIds)];

  if (uniqueSharedLocs.length > 0) {
    // Find location names
    const allLocs = [...(myData.allLocations || []), ...(theirData.allLocations || [])];
    uniqueSharedLocs.slice(0, 2).forEach(locId => {
      const loc = allLocs.find(l => l.id === locId);
      if (loc) vibes.push({ type: 'location', icon: '📍', text: `Cùng trải nghiệm ${loc.name}` });
    });
    if (uniqueSharedLocs.length > 2) {
      vibes.push({ type: 'location', icon: '📍', text: `+${uniqueSharedLocs.length - 2} địa điểm chung khác` });
    }
  }

  // 3. Same level
  if (myData.level && theirData.level && myData.level === theirData.level) {
    vibes.push({ type: 'level', icon: '🏅', text: `Cùng cấp độ Level ${myData.level}` });
  }

  return vibes;
}

/**
 * Compute fun-fact insights from user data
 */
export function computeInsights(locations, posts, reviews) {
  const insights = [];

  // 1. Average rating given
  if (reviews.length > 0) {
    const avgRating = reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length;
    const rounded = Math.round(avgRating * 10) / 10;
    let ratingComment = '';
    if (rounded >= 4.5) ratingComment = 'Bạn là người rất dễ tính! 😄';
    else if (rounded >= 3.5) ratingComment = 'Bạn đánh giá khá công bằng! ⚖️';
    else ratingComment = 'Bạn là reviewer khắt khe đấy! 🧐';
    insights.push({ icon: '⭐', label: 'Rating trung bình', value: `${rounded}/5`, comment: ratingComment });
  }

  // 2. Hottest post
  if (posts.length > 0) {
    const hottest = posts.reduce((best, p) => {
      const score = (p.upvotes || p.likes || 0) + (p.commentCount || 0);
      const bestScore = (best.upvotes || best.likes || 0) + (best.commentCount || 0);
      return score > bestScore ? p : best;
    }, posts[0]);
    const hotScore = (hottest.upvotes || hottest.likes || 0) + (hottest.commentCount || 0);
    if (hotScore > 0) {
      insights.push({
        icon: '🔥',
        label: 'Bài viết hot nhất',
        value: hottest.title?.substring(0, 30) + (hottest.title?.length > 30 ? '...' : ''),
        comment: `${hottest.upvotes || hottest.likes || 0} likes · ${hottest.commentCount || 0} bình luận`,
        postId: hottest.id
      });
    }
  }

  // 3. Most active category
  if (locations.length > 0) {
    const catCounts = {};
    locations.forEach(l => { catCounts[l.category] = (catCounts[l.category] || 0) + 1; });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      const catLabels = { Food: 'Ăn uống 🍜', Cafe: 'Cafe ☕', Housing: 'Nhà trọ 🏠', Play: 'Vui chơi 🎡', Other: 'Khác 📌' };
      insights.push({ icon: '📊', label: 'Thể loại yêu thích', value: catLabels[topCat[0]] || topCat[0], comment: `${topCat[1]} địa điểm` });
    }
  }

  // 4. Total content contribution
  const totalContent = locations.length + posts.length + reviews.length;
  if (totalContent > 0) {
    insights.push({ icon: '📈', label: 'Tổng đóng góp', value: `${totalContent} nội dung`, comment: `${locations.length} địa điểm · ${posts.length} bài viết · ${reviews.length} đánh giá` });
  }

  return insights;
}

/**
 * Generate milestone timeline from user data
 */
export function computeMilestones(userData, locations, posts, reviews) {
  const milestones = [];

  // Join date
  if (userData?.createdAt) {
    milestones.push({ date: new Date(userData.createdAt), icon: '🎉', title: 'Gia nhập cộng đồng', desc: 'Chào mừng thành viên mới!' });
  }

  // First location
  if (locations.length > 0) {
    const oldest = [...locations].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
    if (oldest?.createdAt) {
      milestones.push({ date: new Date(oldest.createdAt), icon: '📍', title: `Địa điểm đầu tiên`, desc: oldest.name });
    }
  }

  // First post
  if (posts.length > 0) {
    const oldest = [...posts].sort((a, b) => {
      const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dA - dB;
    })[0];
    const postDate = oldest?.createdAt?.toDate ? oldest.createdAt.toDate() : new Date(oldest?.createdAt);
    if (postDate && !isNaN(postDate)) {
      milestones.push({ date: postDate, icon: '📝', title: 'Bài viết đầu tiên', desc: oldest.title });
    }
  }

  // First review
  if (reviews.length > 0) {
    const oldest = [...reviews].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
    if (oldest?.createdAt) {
      milestones.push({ date: new Date(oldest.createdAt), icon: '⭐', title: 'Đánh giá đầu tiên', desc: oldest.locationName || 'Địa điểm' });
    }
  }

  // Badges earned
  (userData?.badges || []).forEach(badge => {
    if (badge.earnedAt) {
      milestones.push({ date: new Date(badge.earnedAt), icon: badge.icon || '🏆', title: `Mở khóa "${badge.name}"`, desc: 'Huy hiệu mới!' });
    }
  });

  // Milestones for content counts
  if (locations.length >= 5) milestones.push({ date: new Date(), icon: '🗺️', title: '5 Địa điểm!', desc: 'Bạn là dân sành sỏi!' });
  if (posts.length >= 5) milestones.push({ date: new Date(), icon: '📰', title: '5 Bài viết!', desc: 'Nhà sáng tạo nội dung!' });
  if (reviews.length >= 10) milestones.push({ date: new Date(), icon: '💬', title: '10 Đánh giá!', desc: 'Reviewer chuyên nghiệp!' });

  // Sort by date descending
  milestones.sort((a, b) => b.date - a.date);
  return milestones;
}

// ═══════════════════════════════════════════════════════════
// AUTO-MODERATION — Smart Content Detection
// ═══════════════════════════════════════════════════════════

const BANNED_WORDS = [
  // Lừa đảo / scam
  'lừa đảo', 'scam', 'hack', 'chuyển khoản', 'chuyển tiền ngay',
  'cọc trước', 'đặt cọc ngay', 'cần gấp tiền', 'vay nóng', 'cho vay',
  'tín dụng đen', 'cá độ', 'đánh bài', 'cá cược', 'casino',
  // Nội dung 18+
  'sugar daddy', 'sugar baby', 'sugar mommy', 'tìm sugar',
  'qua đêm', 'fwb', 'ons', 'one night', 'tình một đêm',
  // Quảng cáo / MLM
  'thu nhập thụ động', 'kiếm tiền online', 'mlm', 'đa cấp',
  'hoa hồng cao', 'tuyển cộng tác viên', 'ctv bán hàng',
  'thu nhập 8 chữ số', 'tự do tài chính',
  // Ma túy
  'cỏ', 'ke', 'lắc', 'đá', 'thuốc lắc', 'heroin', 'cocaine',
  'chất cấm', 'hàng trắng', 'hàng đá',
];

const SUSPICIOUS_PATTERNS = [
  // Số điện thoại Việt Nam
  /(\+?84|0)(3[2-9]|5[25689]|7[06-9]|8[1-689]|9[0-46-9])\d{7}/g,
  // Link URL
  /https?:\/\/[^\s]+/gi,
  // Zalo/Facebook/Telegram link
  /zalo\.me|m\.me|t\.me|wa\.me|bit\.ly|tinyurl/gi,
  // Email
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Nhiều số liên tiếp (có thể là SĐT ẩn)
  /\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d[\s.-]?\d/g,
  // Viết tắt SĐT: "sdt", "s.d.t", "số đt"
  /s[.\s]*d[.\s]*t|số\s*đ[iện]*\s*t[hoại]*/gi,
];

/**
 * Hệ thống auto-moderation thông minh
 * Trả về: { status: 'approved' | 'pending' | 'rejected', flags: string[], riskScore: number }
 */
export function autoModerateContent(text, options = {}) {
  const { checkBanned = true, checkPatterns = true, checkSpam = true } = options;
  const flags = [];
  let riskScore = 0;
  const lowerText = (text || '').toLowerCase().trim();

  if (!lowerText) return { status: 'approved', flags: [], riskScore: 0 };

  // 1. Banned words check
  if (checkBanned) {
    for (const word of BANNED_WORDS) {
      if (lowerText.includes(word.toLowerCase())) {
        flags.push(`🚫 Từ khóa cấm: "${word}"`);
        riskScore += 50;
      }
    }
  }

  // 2. Suspicious patterns check
  if (checkPatterns) {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      const matches = lowerText.match(regex);
      if (matches) {
        if (pattern.source.includes('84') || pattern.source.includes('\\d')) {
          flags.push(`📱 Phát hiện SĐT/số liên hệ: "${matches[0]}"`);
          riskScore += 30;
        } else if (pattern.source.includes('http') || pattern.source.includes('zalo')) {
          flags.push(`🔗 Phát hiện link/liên kết: "${matches[0]}"`);
          riskScore += 25;
        } else if (pattern.source.includes('@')) {
          flags.push(`📧 Phát hiện email: "${matches[0]}"`);
          riskScore += 20;
        } else {
          flags.push(`⚠️ Pattern đáng ngờ: "${matches[0]}"`);
          riskScore += 15;
        }
      }
    }
  }

  // 3. Spam pattern check
  if (checkSpam) {
    // Quá nhiều chữ HOA
    const upperCount = (text.match(/[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    if (totalChars > 10 && upperCount / totalChars > 0.6) {
      flags.push('📢 Quá nhiều chữ HOA (spam)');
      riskScore += 15;
    }

    // Lặp ký tự quá nhiều (e.g. "aaaaaa", "!!!!!!")
    if (/(.)\1{5,}/g.test(text)) {
      flags.push('🔁 Lặp ký tự bất thường');
      riskScore += 10;
    }

    // Text quá ngắn hoặc vô nghĩa (< 3 ký tự)
    if (lowerText.length < 3 && lowerText.length > 0) {
      flags.push('📝 Nội dung quá ngắn');
      riskScore += 10;
    }
  }

  // Quyết định status dựa trên riskScore
  let status;
  if (riskScore >= 50) {
    status = 'pending'; // Cần admin duyệt
  } else if (riskScore >= 30) {
    status = 'pending'; // Nghi ngờ → admin review
  } else {
    status = 'approved'; // Sạch → auto-approve
  }

  return { status, flags, riskScore };
}

/**
 * Lấy danh sách buddy requests đang chờ duyệt
 */
export async function getPendingBuddyRequests() {
  const q = query(
    collection(db, 'buddyRequests'),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return requests.sort((a, b) => {
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
    return dateB - dateA;
  });
}

// ═══════════════════════════════════════════════════════════
// PRESENCE — Online Users Tracking (Admin Level 1 only)
// ═══════════════════════════════════════════════════════════

/**
 * Lấy danh sách users đang online (lastActive trong 3 phút gần nhất)
 * Chỉ dành cho Admin cấp 1
 */
export async function getOnlineUsers() {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  const now = new Date();
  const THREE_MINUTES = 3 * 60 * 1000;

  const users = snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .map(user => {
      const lastActive = user.lastActive?.toDate
        ? user.lastActive.toDate()
        : user.lastActive ? new Date(user.lastActive) : null;
      const isOnline = lastActive && (now - lastActive) < THREE_MINUTES;
      return { ...user, lastActive, isOnline: !!isOnline };
    })
    .sort((a, b) => {
      // Online users first, then sort by lastActive
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      const dateA = a.lastActive || new Date(0);
      const dateB = b.lastActive || new Date(0);
      return dateB - dateA;
    });

  return users;
}

/**
 * Lấy tổng số users và số đang online
 */
export async function getUserCounts() {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  const now = new Date();
  const THREE_MINUTES = 3 * 60 * 1000;

  let onlineCount = 0;
  snapshot.docs.forEach(d => {
    const data = d.data();
    const lastActive = data.lastActive?.toDate
      ? data.lastActive.toDate()
      : data.lastActive ? new Date(data.lastActive) : null;
    if (lastActive && (now - lastActive) < THREE_MINUTES) {
      onlineCount++;
    }
  });

  return { totalUsers: snapshot.size, onlineCount };
}

// ═══════════════════════════════════════════════════════════
// BUDDY CHAT — Connection & Messaging
// ═══════════════════════════════════════════════════════════


/**
 * Tạo kết nối buddy mới hoặc trả về connection đã tồn tại
 * @returns {{ connectionId: string, isNew: boolean }}
 */
export async function createBuddyConnection(requestId, requestData, currentUser, requestOwnerUserId) {
  // Kiểm tra đã tồn tại connection giữa 2 user cho request này chưa
  const connectionsRef = collection(db, 'buddyConnections');
  const existingSnap = await getDocs(connectionsRef);
  const existing = existingSnap.docs.find(d => {
    const data = d.data();
    return data.requestId === requestId &&
      data.participants?.includes(currentUser.uid) &&
      data.participants?.includes(requestOwnerUserId);
  });

  if (existing) {
    return { connectionId: existing.id, isNew: false };
  }

  // Tạo connection mới
  const connectionData = {
    requestId,
    requestTitle: requestData.university || 'Kết nối buddy',
    requestType: requestData.type || 'roommate',
    participants: [requestOwnerUserId, currentUser.uid],
    participantNames: {
      [requestOwnerUserId]: requestData.userName || 'Ẩn danh',
      [currentUser.uid]: currentUser.displayName || currentUser.email || 'Ẩn danh',
    },
    status: 'active',
    createdAt: serverTimestamp(),
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    unreadCount: {
      [requestOwnerUserId]: 1,
      [currentUser.uid]: 0,
    },
  };

  const docRef = await addDoc(connectionsRef, connectionData);

  // Cập nhật buddyRequest: thêm connectionCount + connectedBy
  const requestRef = doc(db, 'buddyRequests', requestId);
  await updateDoc(requestRef, {
    connectionCount: increment(1),
    connectedBy: arrayUnion(currentUser.uid),
  });

  return { connectionId: docRef.id, isNew: true };
}

/**
 * Gửi tin nhắn trong buddy chat
 */
export async function sendBuddyChatMessage(connectionId, senderId, senderName, text) {
  const messagesRef = collection(db, 'buddyConnections', connectionId, 'messages');
  await addDoc(messagesRef, {
    senderId,
    senderName,
    text,
    type: 'text',
    createdAt: serverTimestamp(),
  });

  // Cập nhật lastMessage + unread count cho connection
  const connectionRef = doc(db, 'buddyConnections', connectionId);
  const connectionSnap = await getDoc(connectionRef);
  if (connectionSnap.exists()) {
    const data = connectionSnap.data();
    const otherUserId = data.participants?.find(id => id !== senderId);
    const updates = {
      lastMessage: text.length > 100 ? text.substring(0, 100) + '...' : text,
      lastMessageAt: serverTimestamp(),
    };
    if (otherUserId) {
      updates[`unreadCount.${otherUserId}`] = increment(1);
    }
    await updateDoc(connectionRef, updates);
  }
}

/**
 * Lấy tất cả connections của 1 user
 */
export async function getBuddyConnections(userId) {
  const connectionsRef = collection(db, 'buddyConnections');
  const snap = await getDocs(connectionsRef);
  const connections = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => c.participants?.includes(userId))
    .sort((a, b) => {
      const dateA = a.lastMessageAt?.toDate ? a.lastMessageAt.toDate() : new Date(a.lastMessageAt);
      const dateB = b.lastMessageAt?.toDate ? b.lastMessageAt.toDate() : new Date(b.lastMessageAt);
      return dateB - dateA;
    });
  return connections;
}

/**
 * Đánh dấu đã đọc cho user trong connection
 */
export async function markBuddyChatAsRead(connectionId, userId) {
  const connectionRef = doc(db, 'buddyConnections', connectionId);
  await updateDoc(connectionRef, {
    [`unreadCount.${userId}`]: 0,
  });
}

/**
 * Đóng buddy connection
 */
export async function closeBuddyConnection(connectionId) {
  const connectionRef = doc(db, 'buddyConnections', connectionId);
  await updateDoc(connectionRef, {
    status: 'closed',
  });
}



