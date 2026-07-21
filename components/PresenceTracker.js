'use client';

import { useEffect } from 'react';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { recordSiteVisit } from '@/lib/firestore';

/**
 * PresenceTracker — Component vô hình theo dõi trạng thái online
 * 
 * Cập nhật `lastActive` timestamp mỗi 60 giây vào Firestore user doc.
 * User được coi là "online" nếu lastActive trong vòng 3 phút gần nhất.
 * 
 * Cách dùng: Đặt <PresenceTracker /> trong layout hoặc ProtectedRoute
 */
export default function PresenceTracker() {
  useEffect(() => {
    // Ghi nhận lượt truy cập site (mỗi phiên truy cập 1 lần)
    if (typeof window !== 'undefined' && !sessionStorage.getItem('cityz_visited')) {
      sessionStorage.setItem('cityz_visited', 'true');
      recordSiteVisit();
    }

    let intervalId = null;
    let currentUserId = null;


    const updatePresence = async (uid) => {
      try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
          lastActive: serverTimestamp(),
          isOnline: true,
        });
      } catch (err) {
        // Silently fail — user doc might not exist yet
      }
    };

    const markOffline = async (uid) => {
      try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
          isOnline: false,
        });
      } catch (err) {
        // Silently fail
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Clear previous interval
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      if (user) {
        currentUserId = user.uid;
        // Immediate presence update
        updatePresence(user.uid);
        // Heartbeat every 60 seconds
        intervalId = setInterval(() => {
          updatePresence(user.uid);
        }, 60000);
      } else {
        if (currentUserId) {
          markOffline(currentUserId);
        }
        currentUserId = null;
      }
    });

    // Handle page close/tab close
    const handleBeforeUnload = () => {
      if (currentUserId) {
        // Use sendBeacon for reliability on page close
        const userRef = doc(db, 'users', currentUserId);
        // Fall back to sync call since sendBeacon doesn't work with Firestore
        markOffline(currentUserId);
      }
    };

    // Handle visibility change (tab switch, minimize)
    const handleVisibilityChange = () => {
      if (!currentUserId) return;
      if (document.visibilityState === 'visible') {
        updatePresence(currentUserId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (currentUserId) markOffline(currentUserId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
    };
  }, []);

  return null; // Invisible component
}
