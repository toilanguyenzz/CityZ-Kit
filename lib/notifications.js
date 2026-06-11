import { collection, addDoc, doc, getDocs, updateDoc, query, orderBy, limit, where, onSnapshot, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * ═══════════════════════════════════════════════════════════
 * NOTIFICATION SYSTEM — CityZ Kit Social Features
 * ═══════════════════════════════════════════════════════════
 * 
 * Firestore structure: users/{uid}/notifications (subcollection)
 * Each notification doc:
 *   { type, fromUserId, fromUserName, fromUserAvatar, message, linkUrl, metadata, read, createdAt }
 * 
 * Notification types:
 *   - 'comment'        — someone commented on your post
 *   - 'like'           — someone liked your post
 *   - 'follow'         — someone followed you
 *   - 'badge'          — you earned a new badge
 *   - 'buddy_connect'  — someone connected with your buddy request
 *   - 'repost'         — someone reposted your post
 */

/**
 * Tạo notification mới cho user
 * @param {string} targetUserId - User nhận notification
 * @param {object} data - { type, fromUserId, fromUserName, fromUserAvatar, message, linkUrl, metadata }
 */
export async function createNotification(targetUserId, data) {
  // Không tự gửi notification cho chính mình
  if (data.fromUserId && data.fromUserId === targetUserId) return;
  
  try {
    const notifRef = collection(db, 'users', targetUserId, 'notifications');
    await addDoc(notifRef, {
      type: data.type || 'general',
      fromUserId: data.fromUserId || null,
      fromUserName: data.fromUserName || 'Ai đó',
      fromUserAvatar: data.fromUserAvatar || null,
      message: data.message || '',
      linkUrl: data.linkUrl || null,
      metadata: data.metadata || {},
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

/**
 * Lấy danh sách notifications của user
 * @param {string} userId
 * @param {number} limitCount
 */
export async function getNotifications(userId, limitCount = 30) {
  const notifRef = collection(db, 'users', userId, 'notifications');
  const q = query(notifRef, orderBy('createdAt', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Đánh dấu 1 notification đã đọc
 */
export async function markNotificationAsRead(userId, notificationId) {
  const notifRef = doc(db, 'users', userId, 'notifications', notificationId);
  await updateDoc(notifRef, { read: true });
}

/**
 * Đánh dấu tất cả notifications đã đọc
 */
export async function markAllNotificationsAsRead(userId) {
  const notifRef = collection(db, 'users', userId, 'notifications');
  const q = query(notifRef, where('read', '==', false));
  const snapshot = await getDocs(q);
  
  const batch = writeBatch(db);
  snapshot.docs.forEach(d => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
}

/**
 * Đếm số notifications chưa đọc
 */
export async function getUnreadNotificationCount(userId) {
  const notifRef = collection(db, 'users', userId, 'notifications');
  const q = query(notifRef, where('read', '==', false));
  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Subscribe realtime to notification changes (for NotificationBell)
 * @param {string} userId
 * @param {function} callback - (notifications[]) => void
 * @returns {function} unsubscribe function
 */
export function subscribeToNotifications(userId, callback) {
  const notifRef = collection(db, 'users', userId, 'notifications');
  const q = query(notifRef, orderBy('createdAt', 'desc'), limit(30));
  
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(notifications);
  }, (error) => {
    console.error('Error subscribing to notifications:', error);
  });
}
