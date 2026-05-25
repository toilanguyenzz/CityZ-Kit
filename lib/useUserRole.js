'use client';

import { useState, useEffect } from 'react';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Custom hook để lấy role của user hiện tại.
// Trả về: { role, isAdmin, loading, user }
//
// Cách dùng:
//   const { role, isAdmin, loading } = useUserRole();
//   if (isAdmin) { ... hiển thị trang admin ... }
export default function useUserRole() {
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role || 'user');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
        }
      } else {
        setUser(null);
        setRole('user');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return {
    role,
    isAdmin: role === 'admin',
    loading,
    user,
  };
}
