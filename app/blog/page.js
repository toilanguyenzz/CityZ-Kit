'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { getPosts, votePoll } from '@/lib/firestore';
import toast from 'react-hot-toast';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

export default function BlogList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votedPosts, setVotedPosts] = useState({});
  const [userData, setUserData] = useState(null);
  const [featuredLocations, setFeaturedLocations] = useState([]);

  useEffect(() => {
    fetchPosts();

    // Fetch user profile stats & badges
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          } else {
            setUserData({ name: user.displayName || user.email, badges: [] });
          }
        } catch (e) {
          setUserData({ name: user.displayName || user.email, badges: [] });
        }
      }
    });

    // Fetch featured locations for the sidebar
    const fetchFeatured = async () => {
      try {
        const q = query(
          collection(db, 'locations'),
          orderBy('averageRating', 'desc'),
          limit(2)
        );
        const snapshot = await getDocs(q);
        const locs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));
        setFeaturedLocations(locs);
      } catch (error) {
        console.error('Error fetching featured locations:', error);
      }
    };

    fetchFeatured();

    return () => unsubscribe();
  }, []);

  const fetchPosts = async () => {
    try {
      const data = await getPosts();
      setPosts(data.filter(p => p.status === 'approved' || !p.status));
    } catch (error) {
      toast.error('Không thể tải bài viết');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (postId, optionIndex) => {
    try {
      await votePoll(postId, optionIndex, auth.currentUser?.uid);
      setVotedPosts(prev => ({ ...prev, [postId]: true }));
      toast.success('Đã bình chọn!');
      fetchPosts(); // Refresh to update percentages
    } catch (error) {
      toast.error('Lỗi khi bình chọn');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
         <Navbar />
         <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT SIDEBAR: PROFILE & TRENDS */}
            <aside className="lg:col-span-3 hidden lg:flex flex-col gap-6 sticky top-20">
              {/* User Profile Card */}
              {userData ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 transition hover:shadow-md">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl mb-3 shadow-inner">
                      {userData.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">{userData.name}</h3>
                    <p className="text-xs text-gray-500 font-medium mb-3">
                      {userData.role === 'admin' ? '🛡️ Quản trị viên' : '🎓 Sinh viên'}
                    </p>
                    
                    {/* Badges Section */}
                    {userData.badges && userData.badges.length > 0 ? (
                      <div className="flex flex-wrap justify-center gap-1.5 mt-2 pt-3 border-t border-gray-100 w-full">
                        {userData.badges.map((badge, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-blue-100 shadow-sm"
                            title={badge.name}
                          >
                            <span>{badge.icon}</span>
                            {badge.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-2 italic pt-2 border-t border-gray-100 w-full">Chưa có huy hiệu</p>
                    )}
                    
                    <Link
                      href="/profile"
                      className="mt-4 w-full text-center text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 py-2.5 rounded-xl transition-all"
                    >
                      Xem chi tiết hồ sơ
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center animate-pulse">
                  <div className="w-16 h-16 rounded-full bg-gray-200 mx-auto mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
                </div>
              )}

              {/* Trending Tags Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 transition hover:shadow-md">
                <h4 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                  <span>🏷️</span> Xu hướng tìm kiếm
                </h4>
                <div className="flex flex-col gap-3">
                  {[
                    { tag: 'reviewmonhoc', label: '#ReviewMonHoc', count: '142 bài viết' },
                    { tag: 'giarebinhthanh', label: '#GiaReBinhThanh', count: '98 bài viết' },
                    { tag: 'timphongtro', label: '#TimPhongTro', count: '76 bài viết' },
                    { tag: 'tansinhvien', label: '#TanSinhVien', count: '55 bài viết' },
                  ].map((item, idx) => (
                    <Link
                      key={idx}
                      href={`/blog/tag/${item.tag}`}
                      className="flex flex-col group py-1.5 border-b border-gray-50 last:border-0"
                    >
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-gray-400">{item.count}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>

            {/* CENTER COLUMN: FEED */}
            <div className="lg:col-span-6 flex flex-col items-center gap-6 w-full">
              {/* Quick Post Box */}
              <div className="w-full bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                    {userData?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <Link href="/blog/create" className="w-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-left px-4 py-2 rounded-full transition cursor-pointer flex items-center">
                    Chia sẻ điều gì đó với mọi người...
                  </Link>
                </div>
              </div>

              {posts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl shadow-sm w-full">
                  <p className="text-gray-500 text-lg">Chưa có chia sẻ nào. Hãy là người đầu tiên!</p>
                  <Link href="/blog/create" className="inline-block mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-full font-medium hover:bg-blue-700 transition">Tạo bài viết</Link>
                </div>
              ) : (
                <div className="w-full space-y-6">
                  {posts.map((post) => {
                    const totalVotes = post.pollData?.options?.reduce((sum, opt) => sum + (opt.votes || 0), 0) || 0;
                    return (
                      <Link key={post.id} href={`/post/${post.id}`} className="block group">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all duration-300">
                          <div className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                              {post.authorName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900 leading-tight">{post.authorName}</h3>
                              <p className="text-xs text-gray-500">{formatDate(post.createdAt)}</p>
                            </div>
                          </div>

                          {post.imageUrl && (
                            <div className="relative aspect-video w-full bg-gray-100 overflow-hidden">
                              <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                            </div>
                          )}

                          <div className="p-4">
                            <h2 className="text-lg font-bold text-gray-900 mb-2">{post.title}</h2>

                            {post.type === 'poll' ? (
                              <div className="space-y-2 mb-4" onClick={(e) => e.preventDefault()}>
                                {post.pollData?.options?.map((opt, idx) => {
                                  const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                                  return (
                                    <div key={idx} className="relative w-full h-10 bg-gray-100 rounded-xl overflow-hidden cursor-pointer group/opt">
                                      <div
                                        className="absolute left-0 top-0 h-full bg-blue-500/20 transition-all duration-500"
                                        style={{ width: `${percent}%` }}
                                      />
                                      <div className="absolute inset-0 flex items-center justify-between px-4 text-sm font-medium text-gray-700">
                                        <span>{opt.text}</span>
                                        <span>{percent}%</span>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleVote(post.id, idx);
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white border border-gray-200 px-3 py-1 rounded-lg text-xs hover:bg-blue-50 transition shadow-sm font-medium"
                                      >
                                        Vote
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-gray-600 text-sm leading-relaxed line-clamp-3 mb-4">
                                {post.content.split(/(\#\w+)/g).map((part, i) =>
                                  part.startsWith('#') ? (
                                    <Link key={i} href={`/blog/tag/${part.substring(1).toLowerCase()}`} className="text-blue-600 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                                      {part}
                                    </Link>
                                  ) : (
                                    part
                                  ))}
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                              <div className="flex gap-4">
                                <button className="flex items-center gap-1.5 text-gray-500 hover:text-red-500 transition text-sm font-medium" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                  <span>❤️</span> Like
                                </button>
                                <button className="flex items-center gap-1.5 text-gray-500 hover:text-blue-500 transition text-sm font-medium" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                  <span>💬</span> Bình luận
                                </button>
                              </div>
                              <div className="text-blue-600 text-sm font-semibold group-hover:underline">Xem chi tiết →</div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    )})}
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR: AI COPILOT & STUDENT SITES */}
            <aside className="lg:col-span-3 hidden lg:flex flex-col gap-6 sticky top-20">
              {/* AI Gemini Mini Form */}
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-2xl shadow-sm p-5 relative overflow-hidden group transition hover:shadow-md">
                {/* background glow */}
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2 relative z-10">
                  <span>🤖</span> Trợ lý AI Gemini
                </h4>
                <p className="text-xs text-blue-100 leading-relaxed mb-4 relative z-10">
                  Bạn cần tìm quán ăn ngon, nhà trọ giá rẻ hay quán cafe học bài? Nhập nhanh yêu cầu để nhận gợi ý tức thì!
                </p>
                
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = e.target.query.value;
                    if (q.trim()) {
                      window.location.href = `/recommend?q=${encodeURIComponent(q)}`;
                    }
                  }}
                  className="flex gap-2 relative z-10"
                >
                  <input
                    type="text"
                    name="query"
                    placeholder="Bạn muốn hỏi gì..."
                    className="flex-1 bg-white/15 hover:bg-white/20 focus:bg-white text-white focus:text-gray-900 placeholder-blue-100 focus:placeholder-gray-400 text-xs rounded-xl px-3 py-2 border border-white/10 focus:border-white focus:outline-none transition-all"
                  />
                  <button
                    type="submit"
                    className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-3 py-2 rounded-xl transition text-xs flex items-center justify-center shrink-0 shadow-sm"
                    title="Gửi câu hỏi"
                  >
                    ⚡
                  </button>
                </form>
              </div>

              {/* Featured Student Spots Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 transition hover:shadow-md">
                <h4 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                  <span>📍</span> Điểm đến đề xuất
                </h4>
                
                {featuredLocations.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {featuredLocations.map((loc) => (
                      <Link
                        key={loc.id}
                        href={`/location/${loc.id}`}
                        className="flex gap-3 group border-b border-gray-50 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                          {loc.imageUrl ? (
                            <img src={loc.imageUrl} alt={loc.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-500 font-bold">📍</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-xs text-gray-800 leading-snug truncate group-hover:text-blue-600 transition">
                            {loc.name}
                          </h5>
                          <p className="text-[10px] text-gray-500 truncate mb-1">📍 {loc.address}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-yellow-500 flex items-center gap-0.5">
                              ⭐ {loc.averageRating ? Number(loc.averageRating).toFixed(1) : '0.0'}
                            </span>
                            <span className="text-[9px] text-gray-400">({loc.reviewCount || 0} đánh giá)</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic text-center py-4">Chưa có địa điểm nổi bật</p>
                )}
                
                <Link
                  href="/dashboard"
                  className="block text-center text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 py-2.5 rounded-xl mt-4 transition"
                >
                  Khám phá thêm địa điểm →
                </Link>
              </div>

              {/* Active Members Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 transition hover:shadow-md">
                <h4 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                  <span>🏆</span> Đóng góp nhiều nhất
                </h4>
                <div className="flex flex-col gap-3">
                  {[
                    { name: 'Nguyen Ta', role: 'Đại sứ sinh viên', points: '120 đóng góp', badge: '👑' },
                    { name: 'Minh Tran', role: 'Cộng tác viên', points: '95 đóng góp', badge: '🥈' }
                  ].map((member, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 py-1">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center font-bold text-xs text-blue-600 shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <h5 className="font-bold text-xs text-gray-800 truncate">{member.name}</h5>
                          <span className="text-xs shrink-0">{member.badge}</span>
                        </div>
                        <p className="text-[9px] text-gray-400">{member.role} · {member.points}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}


