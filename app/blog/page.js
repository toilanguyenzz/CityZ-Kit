'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth, onAuthStateChanged } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { getPosts, votePoll } from '@/lib/firestore';
import toast from 'react-hot-toast';

export default function BlogList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votedPosts, setVotedPosts] = useState({});

  useEffect(() => {
    fetchPosts();
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
          <div className="flex flex-col items-center gap-8">
            {/* Quick Post Box */}
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">U</div>
                <Link href="/blog/create" className="w-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-left px-4 py-2 rounded-full transition cursor-pointer">
                  Chia sẻ điều gì đó với mọi người...
                </Link>
              </div>
            </div>

            {posts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl shadow-sm w-full max-w-2xl">
                <p className="text-gray-500 text-lg">Chưa có chia sẻ nào. Hãy là người đầu tiên!</p>
                <Link href="/blog/create" className="inline-block mt-4 bg-blue-600 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-700 transition">Tạo bài viết</Link>
              </div>
            ) : (
              <div className="w-full max-w-2xl space-y-6">
                {posts.map((post) => {
                  const totalVotes = post.pollData?.options?.reduce((sum, opt) => sum + (opt.votes || 0), 0) || 0;
                  return (
                    <Link key={post.id} href={`/post/${post.id}`} className="block group">
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:border-blue-300 transition-all">
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
                          <div className="relative aspect-video w-full bg-gray-100">
                            <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
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
                                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white border border-gray-200 px-2 py-1 rounded-lg text-xs hover:bg-blue-50 transition"
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
                                  <Link key={i} href={`/blog/tag/${part.substring(1).toLowerCase()}`} className="text-blue-600 hover:underline font-medium">
                                    {part}
                                  </Link>
                                ) : (
                                  part
                                ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                            <div className="flex gap-4">
                              <button className="flex items-center gap-1 text-gray-500 hover:text-red-500 transition text-sm font-medium">
                                <span>❤️</span> Like
                              </button>
                              <button className="flex items-center gap-1 text-gray-500 hover:text-blue-500 transition text-sm font-medium">
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
        </main>
      </div>
    </ProtectedRoute>
  );
}
