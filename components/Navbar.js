'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, onAuthStateChanged } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import toast from 'react-hot-toast';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Đã đăng xuất');
      router.push('/');
    } catch (error) {
      toast.error('Lỗi đăng xuất');
    }
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-blue-600">CityZ Kit</Link>
          </div>
          {user && (
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/dashboard" className="text-gray-700 hover:text-blue-600 transition">Khám phá</Link>
              <Link href="/add-location" className="text-gray-700 hover:text-blue-600 transition">+ Địa điểm</Link>
              <Link href="/blog" className="text-gray-700 hover:text-blue-600 transition">Blog</Link>
              <Link href="/recommend" className="text-gray-700 hover:text-blue-600 transition">Gợi ý AI</Link>
              <Link href="/profile" className="text-gray-700 hover:text-blue-600 transition">Hồ sơ</Link>
              <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg transition">Đăng xuất</button>
            </div>
          )}
          {user && (
            <div className="flex md:hidden items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-gray-700 hover:text-blue-600 focus:outline-none"
              >
                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                  {isOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          )}
          {!user && (
            <div className="flex items-center space-x-3">
              <Link href="/login" className="text-blue-600 hover:underline">Đăng nhập</Link>
              <Link href="/signup" className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700">Đăng ký</Link>
            </div>
          )}
        </div>
      </div>
      {/* Mobile Menu */}
      {user && isOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 pt-2 pb-4 space-y-1">
          <Link href="/dashboard" onClick={() => setIsOpen(false)} className="block py-2 text-gray-700 hover:text-blue-600 transition font-medium">Khám phá</Link>
          <Link href="/add-location" onClick={() => setIsOpen(false)} className="block py-2 text-gray-700 hover:text-blue-600 transition font-medium">+ Địa điểm</Link>
          <Link href="/blog" onClick={() => setIsOpen(false)} className="block py-2 text-gray-700 hover:text-blue-600 transition font-medium">Blog</Link>
          <Link href="/recommend" onClick={() => setIsOpen(false)} className="block py-2 text-gray-700 hover:text-blue-600 transition font-medium">Gợi ý AI</Link>
          <Link href="/profile" onClick={() => setIsOpen(false)} className="block py-2 text-gray-700 hover:text-blue-600 transition font-medium">Hồ sơ</Link>
          <button onClick={() => { handleLogout(); setIsOpen(false); }} className="w-full text-left bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition mt-2 font-medium">Đăng xuất</button>
        </div>
      )}
    </nav>
  );
}
