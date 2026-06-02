'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { doc, onSnapshot, collection, query } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import useUserRole from '@/lib/useUserRole';
import toast from 'react-hot-toast';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCommunityOpen, setIsCommunityOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin } = useUserRole();


  useEffect(() => {
    let unsubscribeDoc = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        unsubscribeDoc = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            setDbUser(snapshot.data());
          }
        }, (error) => {
          console.error("Error listening to user doc:", error);
        });
      } else {
        setDbUser(null);
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const q = query(collection(db, 'buddyConnections'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const conns = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.participants?.includes(user.uid));
      const total = conns.reduce((sum, c) => sum + (c.unreadCount?.[user.uid] || 0), 0);
      setUnreadCount(total);
    }, (error) => {
      console.error("Error listening to unread count in Navbar:", error);
    });
    return () => unsubscribe();
  }, [user]);



  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Đã đăng xuất');
      router.push('/');
    } catch (error) {
      toast.error('Lỗi đăng xuất');
    }
  };

  const avatarUrl = dbUser?.avatarUrl || user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(dbUser?.name || user?.displayName || user?.email || 'U')}&background=3b82f6&color=fff`;

  /* ── Primary nav items — 4 pillars ─────────────── */
  const primaryItems = [
    {
      name: 'Khám phá',
      href: '/dashboard',
      icon: (active) => (
        <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L16 4m0 13V4m0 0L9 7" />
        </svg>
      )
    },
    {
      name: 'Cộng đồng',
      href: '/blog',
      icon: (active) => (
        <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      name: 'Kết nối',
      href: '/buddy-finder',
      icon: (active) => (
        <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    },
    {
      name: 'Tin nhắn',
      href: '/messages',
      icon: (active) => (
        <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      )
    },
    {
      name: 'Góp ý',
      href: '/recommend',
      icon: (active) => (
        <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
    },
  ];

  // Community dropdown removed — merged into 3 pillars

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100/85 sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo Section */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2 group">
              <img 
                src="/logo.png" 
                alt="CityZ Kit Logo" 
                className="h-9 w-9 object-contain rounded-lg transition-transform group-hover:scale-105" 
              />
              <span className="text-xl font-extrabold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent group-hover:opacity-95 transition-opacity">
                CityZ Kit
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          {user && (
            <div className="hidden md:flex items-center space-x-1 lg:space-x-1.5">
              {primaryItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                      isActive 
                        ? 'text-blue-600 bg-blue-50/50' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {item.icon(isActive)}
                    <span>{item.name}</span>
                    {item.name === 'Tin nhắn' && unreadCount > 0 && (
                      <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </Link>
                );
              })}

            </div>
          )}

          {/* User Profile / Action Buttons */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {/* User Dropdown (Desktop) */}
                <div className="hidden md:block relative">
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center space-x-2 p-1.5 rounded-full hover:bg-gray-100 transition focus:outline-none"
                  >
                    <img 
                      src={avatarUrl} 
                      alt="Avatar" 
                      className="w-8 h-8 rounded-full border border-gray-200" 
                    />
                    <span className="hidden lg:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
                      {dbUser?.name || user.displayName || user.email?.split('@')[0]}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20">
                        <div className="px-4 py-2.5 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {dbUser?.name || user.displayName || 'Người dùng CityZ'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <div className="p-1">
                          <Link 
                            href="/profile" 
                            onClick={() => setIsDropdownOpen(false)}
                            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                          >
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>Hồ sơ cá nhân</span>
                          </Link>
                          {isAdmin && (
                            <Link 
                              href="/admin" 
                              onClick={() => setIsDropdownOpen(false)}
                              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-purple-600 hover:bg-purple-50 transition font-medium"
                            >
                              <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                              <span>🛡️ Trang Quản trị</span>
                            </Link>
                          )}
                        </div>
                        <div className="border-t border-gray-100 p-1 mt-1">
                          <button 
                            onClick={() => { handleLogout(); setIsDropdownOpen(false); }}
                            className="flex items-center space-x-2 w-full text-left px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition font-medium"
                          >
                            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Đăng xuất</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Mobile Menu Button */}
                <div className="flex md:hidden items-center">
                  <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none transition-colors"
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
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link 
                  href="/login" 
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition"
                >
                  Đăng nhập
                </Link>
                <Link 
                  href="/signup" 
                  className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition shadow-sm hover:shadow"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {user && isOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-lg px-4 py-3 space-y-1 z-45 max-h-[calc(100vh-4rem)] overflow-y-auto">
          {/* User info */}
          <Link 
            href="/profile"
            onClick={() => setIsOpen(false)}
            className="flex items-center space-x-3 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-xl mb-2 transition-colors cursor-pointer group"
          >
            <img 
              src={avatarUrl} 
              alt="Avatar" 
              className="w-10 h-10 rounded-full border border-gray-200 transition-transform group-hover:scale-105" 
            />
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                {dbUser?.name || user.displayName || 'Người dùng CityZ'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Primary nav section */}
          <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Chính</p>
          {primaryItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors ${
                  isActive 
                    ? 'text-blue-600 bg-blue-50/50' 
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {item.icon(isActive)}
                <span>{item.name}</span>
                {item.name === 'Tin nhắn' && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center justify-center min-w-[20px] h-[20px]">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Community dropdown removed — merged into 3 pillars */}

          {/* Admin */}
          {isAdmin && (
            <div className="border-t border-gray-100 pt-2 mt-2">
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-base font-semibold text-purple-600 hover:bg-purple-50 transition-colors"
              >
                <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>🛡️ Quản trị</span>
              </Link>
            </div>
          )}
          
          {/* Logout */}
          <div className="border-t border-gray-100 pt-2 mt-2">
            <button
              onClick={() => { handleLogout(); setIsOpen(false); }}
              className="flex items-center space-x-3 w-full text-left px-3 py-2.5 rounded-lg text-base font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
