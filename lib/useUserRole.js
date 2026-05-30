'use client';

import { useState, useEffect } from 'react';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Custom hook để lấy role của user hiện tại.
// Trả về: { role, isAdmin, adminLevel, isSuperAdmin, loading, user }
//
// Admin Levels:
//   adminLevel = 1  → Super Admin (quyền cao nhất, xem users online, quản lý admin khác)
//   adminLevel = 2  → Admin thường (duyệt nội dung)
//   adminLevel = 0 hoặc undefined → User thường
//
// Cách dùng:
//   const { role, isAdmin, isSuperAdmin, loading } = useUserRole();
//   if (isSuperAdmin) { ... hiển thị tính năng admin cấp 1 ... }
export default function useUserRole() {
  const [role, setRole] = useState('user');
  const [adminLevel, setAdminLevel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const userRole = (data.role || 'user').trim();
            setRole(userRole);
            // adminLevel: 1 = Super Admin, 2 = Admin thường
            // Nếu chưa có adminLevel nhưng role là admin → mặc định adminLevel = 2 (để bảo mật)
            setAdminLevel(
              userRole === 'admin'
                ? (data.adminLevel || 2)
                : 0
            );
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
        }
      } else {
        setUser(null);
        setRole('user');
        setAdminLevel(0);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = role?.trim() === 'admin';

  return {
    role,
    isAdmin,
    adminLevel,
    isSuperAdmin: isAdmin && adminLevel === 1,
    loading,
    user,
  };
}
