'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import toast from 'react-hot-toast';

export default function PostDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);

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
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
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
              <div className="prose max-w-none text-gray-700 mb-8">
                <p>{post.content}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Bình luận ({post.comments?.length || 0})</h2>
            <form onSubmit={handleAddComment} className="mb-6">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows="3"
                placeholder="Viết bình luận..."
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition">Gửi</button>
            </form>
            <div className="space-y-4">
              {post.comments?.length === 0 && <p className="text-gray-500">Chưa có bình luận nào.</p>}
              {post.comments?.map((c) => (
                <div key={c.id} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-gray-900">{c.userName}</span>
                    <span className="text-sm text-gray-500">{formatDate(c.createdAt)}</span>
                  </div>
                  <p className="text-gray-700 mt-1">{c.comment}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
