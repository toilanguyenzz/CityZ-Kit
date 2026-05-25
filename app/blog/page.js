'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth, onAuthStateChanged } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { getPosts } from '@/lib/firestore';
import toast from 'react-hot-toast';

export default function BlogList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const data = await getPosts();
      setPosts(data);
    } catch (error) {
      toast.error('Không thể tải bài viết');
    } finally {
      setLoading(false);
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
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Cộng đồng FreshStart</h1>
            <Link href="/blog/create" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition">+ Viết bài</Link>
          </div>
          {posts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
              <p className="text-gray-500 text-lg">Chưa có bài viết nào.</p>
              <Link href="/blog/create" className="inline-block mt-4 text-blue-600 hover:underline">Tạo bài viết đầu tiên</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <Link key={post.id} href={`/post/${post.id}`} className="block">
                  <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                    {post.imageUrl && (
                      <div className="h-48 w-full bg-gray-200">
                        <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-5">
                      <h2 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">{post.title}</h2>
                      <p className="text-gray-600 mb-4 line-clamp-3">{post.content.substring(0, 120)}...</p>
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span>{post.authorName}</span>
                        <span>{formatDate(post.createdAt)}</span>
                      </div>
                      <div className="mt-3 text-blue-600 font-medium">Đọc tiếp →</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
