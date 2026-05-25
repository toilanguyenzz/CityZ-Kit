'use client';

import { useState, useEffect } from 'react';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Badge from '@/components/Badge';
import toast from 'react-hot-toast';

export default function Profile() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            toast.error('Không tìm thấy thông tin tài khoản trên cơ sở dữ liệu');
          }
        } catch (error) {
          toast.error('Lỗi khi tải thông tin hồ sơ: ' + error.message);
          console.error(error);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const hasBadges = userData?.badges && userData.badges.length > 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Hồ sơ của tôi</h1>
            <div className="mt-4 space-y-2">
              <p><span className="font-semibold">Tên:</span> {userData?.name || 'Chưa cập nhật'}</p>
              <p><span className="font-semibold">Email:</span> {userData?.email || 'Chưa cập nhật'}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Danh hiệu đã đạt được</h2>
            {!hasBadges ? (
              <p className="text-gray-500">Chưa có danh hiệu nào. Hãy tham gia đóng góp để nhận huy hiệu!</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {userData.badges.map((badge, idx) => (
                  <Badge key={idx} name={badge.name} icon={badge.icon} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
