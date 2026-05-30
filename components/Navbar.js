'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import useUserRole from '@/lib/useUserRole';
import toast from 'react-hot-toast';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCommunityOpen, setIsCommunityOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin } = useUserRole();
  const communityRef = useRef(null);
  const communityTimeout = useRef(null);

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

  // Close community dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (communityRef.current && !communityRef.current.contains(e.target)) {
        setIsCommunityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const avatarUrl = dbUser?.avatarUrl || user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(dbUser?.name || user?.displayName || user?.email || 'U')}&background=3b82f6&color=fff`;

  /* ── Primary nav items (flat links) ─────────────── */
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
      name: '+ Địa điểm',
      href: '/add-location',
      icon: (active) => (
        <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      name: 'Blog',
      href: '/blog',
      icon: (active) => (
        <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      )
    },
    {
      name: 'VibeZ 🎬',
      href: '/shorts',
      icon: (active) => (
        <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      name: 'Góp ý',
      href: '/recommend',
      icon: (active) => (
        <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      )
    },
  ];

  /* ── Community sub-items (inside dropdown) ──────── */
  const communityItems = [
    {
      name: 'Tìm bạn đồng hành',
      href: '/buddy-finder',
      emoji: '🤝',
      desc: 'Kết nối bạn ở ghép, bạn cùng học',
      color: 'text-green-600 bg-green-50',
    },
    {
      name: 'Chợ đồ cũ',
      href: '/marketplace',
      emoji: '🛍️',
      desc: 'Mua bán đồ cũ sinh viên giá rẻ',
      color: 'text-blue-600 bg-blue-50',
    },
    {
      name: 'An toàn & Cảnh báo',
      href: '/safety',
      emoji: '🛡️',
      desc: 'Báo cáo lừa đảo, vùng nguy hiểm',
      color: 'text-red-600 bg-red-50',
    },
    {
      name: 'Sự kiện sinh viên',
      href: '/events',
      emoji: '📅',
      desc: 'Lịch sự kiện từ các trường ĐH',
      color: 'text-purple-600 bg-purple-50',
    },
  ];

  const isCommunityActive = communityItems.some(item => pathname === item.href);

  const handleCommunityEnter = () => {
    clearTimeout(communityTimeout.current);
    setIsCommunityOpen(true);
  };

  const handleCommunityLeave = () => {
    communityTimeout.current = setTimeout(() => {
      setIsCommunityOpen(false);
    }, 200);
  };

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
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </Link>
                );
              })}

              {/* Community Mega Dropdown */}
              <div
                ref={communityRef}
                className="relative"
                onMouseEnter={handleCommunityEnter}
                onMouseLeave={handleCommunityLeave}
              >
                <button
                  onClick={() => setIsCommunityOpen(!isCommunityOpen)}
                  className={`group flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                    isCommunityActive || isCommunityOpen
                      ? 'text-blue-600 bg-blue-50/50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isCommunityActive || isCommunityOpen ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Cộng đồng</span>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isCommunityOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  {isCommunityActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>

                {/* Dropdown Panel */}
                {isCommunityOpen && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-100/80 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 mb-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Kết nối & Hỗ trợ</p>
                    </div>
                    {communityItems.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsCommunityOpen(false)}
                          className={`flex items-center gap-3 mx-1.5 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                            isActive
                              ? 'bg-blue-50 ring-1 ring-blue-100'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className={`flex items-center justify-center w-9 h-9 rounded-lg text-lg ${item.color}`}>
                            {item.emoji}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>{item.name}</p>
                            <p className="text-xs text-gray-400 truncate">{item.desc}</p>
                          </div>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0"></span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
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
              </Link>
            );
          })}

          {/* Community section */}
          <div className="border-t border-gray-100 pt-2 mt-2">
            <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Cộng đồng</p>
            {communityItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors ${
                    isActive 
                      ? 'text-blue-600 bg-blue-50/50' 
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span className={`flex items-center justify-center w-8 h-8 rounded-lg text-base ${item.color}`}>
                    {item.emoji}
                  </span>
                  <div>
                    <span>{item.name}</span>
                    <p className="text-xs text-gray-400 font-normal">{item.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>

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
