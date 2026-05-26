'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';
import { votePoll } from '@/lib/firestore';

export default function PostDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    try {
      const docRef = doc(db, 'posts', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPost({ id: docSnap.id, ...docSnap.data() });
      } else {
        toast.error('Không tìm thấy bài viết');
        router.push('/blog');
      }
    } catch (error) {
      toast.error('Lỗi tải bài viết');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (optionIndex) => {
    if (!auth.currentUser) {
      toast.error('Vui lòng đăng nhập để bình chọn');
      return;
    }
    try {
      await votePoll(post.id, optionIndex, auth.currentUser.uid);
      setVoted(true);
      fetchPost(); // Refresh data to show updated percentages
      toast.success('Đã bình chọn thành công!');
    } catch (error) {
      toast.error('Lỗi khi bình chọn');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return;
    }
    try {
      const docRef = doc(db, 'posts', id);
      const newComment = {
        id: Date.now().toString(),
        userId: user.uid,
        userName: user.displayName || user.email,
        comment,
        createdAt: new Date().toISOString(),
      };
      const updatedComments = [...(post.comments || []), newComment];
      await updateDoc(docRef, { comments: updatedComments });
      setPost({ ...post, comments: updatedComments });
      setComment('');
      toast.success('Đã thêm bình luận');
    } catch (error) {
      toast.error('Lỗi thêm bình luận');
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
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {post.imageUrl && (
              <div className="h-72 w-full bg-gray-200">
                <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">{post.title}</h1>
              <div className="flex items-center text-sm text-gray-500 mb-6">
                <span>By {post.authorName}</span>
                <span className="mx-2">•</span>
                <span>{formatDate(post.createdAt)}</span>
              </div>

              {post.type === 'poll' ? (
                <div className="space-y-4 mb-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="font-bold text-blue-900 mb-4">🗳️ Khảo sát: {post.pollData?.question}</p>
                  {(() => {
                    const totalVotes = post.pollData?.options?.reduce((sum, o) => sum + (o.votes || 0), 0) || 0;
                    return (
                      <>
                        {post.pollData?.options?.map((opt, idx) => {
                          const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                          return (
                            <div key={idx} className="relative w-full h-12 bg-white rounded-xl overflow-hidden border border-blue-200 cursor-pointer group" onClick={() => !voted && handleVote(idx)}>
                              <div
                                className="absolute left-0 top-0 h-full bg-blue-500/20 transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                              <div className="absolute inset-0 flex items-center justify-between px-4 text-sm font-medium text-gray-700">
                                <span>{opt.text}</span>
                                <span className="font-bold text-blue-600">{percent}%</span>
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-xs text-blue-500 italic text-center">
                          {totalVotes > 0 ? `Tổng cộng ${totalVotes} lượt bình chọn` : 'Hãy bình chọn ngay!'}
                        </p>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="prose max-w-none text-gray-700 mb-8">
                  <div className="whitespace-pre-wrap">
                    {post.content.split(/(\#\w+)/g).map((part, i) =>
                      part.startsWith('#') ? (
                        <Link key={i} href={`/blog/tag/${part.substring(1).toLowerCase()}`} className="text-blue-600 hover:underline font-medium">
                          {part}
                        </Link>
                      ) : (
                        part
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-50 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">Thảo luận ({post.comments?.length || 0})</h2>
            </div>

            <div className="p-6 space-y-6">
              <form onSubmit={handleAddComment} className="flex gap-3 items-end">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">U</div>
                <div className="flex-1 relative">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows="1"
                    placeholder="Chia sẻ ý kiến của bạn..."
                    required
                    className="w-full px-4 py-2 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                  />
                  <button type="submit" className="absolute right-2 bottom-2 bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </form>

              <div className="space-y-4 mt-8">
                {post.comments?.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm italic">Hãy là người đầu tiên bắt đầu cuộc trò chuyện!</p>
                  </div>
                )}
                {post.comments?.map((c) => {
                  const isMe = auth.currentUser?.uid === c.userId;
                  return (
                    <div key={c.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-3`}>
                      {!isMe && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {c.userName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className={`max-w-[80%] ${isMe ? 'order-1' : 'order-2'}`}>
                        <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
                          isMe
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-gray-100 text-gray-800 rounded-tl-none'
                        }`}>
                          {!isMe && <p className="text-[10px] font-bold mb-1 opacity-70">{c.userName}</p>}
                          <p>{c.comment}</p>
                        </div>
                        <div className={`text-[10px] text-gray-400 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          {formatDate(c.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
