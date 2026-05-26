import { collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { compressAndToBase64 } from './imageHelper';
import { db } from './firebase';

async function getUserStats(userId) {
  const locationsQuery = query(collection(db, 'locations'), where('createdBy', '==', userId));
  const locationsSnap = await getDocs(locationsQuery);
  const locationCount = locationsSnap.size;

  const reviewsQuery = query(collection(db, 'reviews'), where('userId', '==', userId));
  const reviewsSnap = await getDocs(reviewsQuery);
  const reviewCount = reviewsSnap.size;

  const postsQuery = query(collection(db, 'posts'), where('userId', '==', userId));
  const postsSnap = await getDocs(postsQuery);
  const postCount = postsSnap.size;

  return { locationCount, reviewCount, postCount };
}

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

  if (newBadges.length > 0) {
    await updateDoc(userRef, { badges: [...currentBadges, ...newBadges] });
  }
}

export async function addLocation(locationData, imageFile, userId, userRole = 'user') {
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
    imageUrl,
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

export async function addPost(userId, authorName, title, content, imageUrl = null, userRole = 'user', type = 'discussion', category = 'general', flair = null) {
  const hashtagRegex = /#(\w+)/g;
  const tags = [];
  let match;
  while ((match = hashtagRegex.exec(content)) !== null) {
    tags.push(match[1].toLowerCase());
  }

  const post = {
    userId,
    authorName,
    title,
    content,
    imageUrl,
    tags,
    type, // 'discussion' | 'question' | 'announcement' | 'poll'
    category, // 'housing' | 'food' | 'academic' | 'general' | 'social'
    flair, // Custom tag like "[URGENT]", "[SOLVED]", etc.
    upvotes: 0,
    upvotedBy: [],
    downvotes: 0,
    downvotedBy: [],
    commentCount: 0,
    viewCount: 0,
    isPinned: false,
    isLocked: false,
    bestAnswerId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: userRole?.trim() === 'admin' ? 'approved' : 'pending',
  };
  const docRef = await addDoc(collection(db, 'posts'), post);
  await checkAndAwardBadges(userId);
  return docRef.id;
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
  let q = collection(db, 'posts');

  // Filter by category if provided
  if (category) {
    q = query(q, where('category', '==', category));
  }

  // Filter only approved posts
  q = query(q, where('status', '==', 'approved'));

  // Apply sorting
  switch (sortBy) {
    case 'new':
      q = query(q, orderBy('createdAt', 'desc'));
      break;
    case 'top':
      q = query(q, orderBy('upvotes', 'desc'), orderBy('commentCount', 'desc'));
      break;
    case 'controversial':
      // Controversial: high upvotes AND high downvotes
      q = query(q, orderBy('downvotes', 'desc'));
      break;
    case 'hot':
    default:
      // Hot: (upvotes - downvotes) / time^1.5
      // For Firestore, we'll order by upvotes first, then by createdAt
      q = query(q, orderBy('upvotes', 'desc'), orderBy('createdAt', 'desc'));
      break;
  }

  q = query(q, limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
  return { id: docSnap.id, ...docSnap.data() };
}

export async function addCommentToPost(postId, userId, userName, comment) {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);
  const post = postSnap.data();
  const newComment = {
    id: Date.now().toString(),
    userId,
    userName,
    comment,
    createdAt: new Date().toISOString(),
  };
  const updatedComments = [...(post.comments || []), newComment];
  await updateDoc(postRef, { comments: updatedComments });
  return newComment.id;
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
