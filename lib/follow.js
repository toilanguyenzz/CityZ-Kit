import { collection, doc, getDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, increment, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { createNotification } from './notifications';

/**
 * ═══════════════════════════════════════════════════════════
 * FOLLOW SYSTEM — CityZ Kit Social Features
 * ═══════════════════════════════════════════════════════════
 * 
 * Firestore structure:
 *   users/{uid}/following/{targetUid}  → { createdAt }
 *   users/{uid}/followers/{followerUid} → { createdAt }
 *   users/{uid} doc → followingCount, followerCount (denormalized)
 */

/**
 * Follow hoặc Unfollow user (toggle)
 * @returns {boolean} true nếu vừa follow, false nếu vừa unfollow
 */
export async function followUser(currentUserId, targetUserId, currentUserName = '', currentUserAvatar = null) {
  if (currentUserId === targetUserId) return false;
  
  const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const followerRef = doc(db, 'users', targetUserId, 'followers', currentUserId);
  
  const followingSnap = await getDoc(followingRef);
  const isFollowing = followingSnap.exists();
  
  if (isFollowing) {
    // Unfollow
    await deleteDoc(followingRef);
    await deleteDoc(followerRef);
    
    // Update counters
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);
    await updateDoc(currentUserRef, { followingCount: increment(-1) });
    await updateDoc(targetUserRef, { followerCount: increment(-1) });
    
    return false;
  } else {
    // Follow
    await setDoc(followingRef, { createdAt: serverTimestamp() });
    await setDoc(followerRef, { createdAt: serverTimestamp() });
    
    // Update counters
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);
    await updateDoc(currentUserRef, { followingCount: increment(1) });
    await updateDoc(targetUserRef, { followerCount: increment(1) });
    
    // Send notification
    await createNotification(targetUserId, {
      type: 'follow',
      fromUserId: currentUserId,
      fromUserName: currentUserName,
      fromUserAvatar: currentUserAvatar,
      message: `${currentUserName} đã theo dõi bạn`,
      linkUrl: `/profile/${currentUserId}`,
    });
    
    return true;
  }
}

/**
 * Kiểm tra user A có đang follow user B không
 */
export async function isFollowing(currentUserId, targetUserId) {
  if (!currentUserId || !targetUserId) return false;
  const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const snap = await getDoc(followingRef);
  return snap.exists();
}

/**
 * Lấy danh sách followers của user
 */
export async function getFollowers(userId, limitCount = 50) {
  const followersRef = collection(db, 'users', userId, 'followers');
  const q = query(followersRef, orderBy('createdAt', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  
  // Fetch user profiles for each follower
  const followers = await Promise.all(
    snapshot.docs.map(async (d) => {
      const followerUid = d.id;
      const userRef = doc(db, 'users', followerUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        return { uid: followerUid, ...userSnap.data() };
      }
      return { uid: followerUid, name: 'Unknown' };
    })
  );
  
  return followers;
}

/**
 * Lấy danh sách following của user
 */
export async function getFollowing(userId, limitCount = 50) {
  const followingRef = collection(db, 'users', userId, 'following');
  const q = query(followingRef, orderBy('createdAt', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  
  const following = await Promise.all(
    snapshot.docs.map(async (d) => {
      const followedUid = d.id;
      const userRef = doc(db, 'users', followedUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        return { uid: followedUid, ...userSnap.data() };
      }
      return { uid: followedUid, name: 'Unknown' };
    })
  );
  
  return following;
}

/**
 * Lấy follower/following count (từ denormalized fields trên user doc)
 */
export async function getFollowCounts(userId) {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return { followerCount: 0, followingCount: 0 };
  const data = snap.data();
  return {
    followerCount: data.followerCount || 0,
    followingCount: data.followingCount || 0,
  };
}
