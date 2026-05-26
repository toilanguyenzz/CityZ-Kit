'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import ThreadCard from '@/components/ThreadCard';
import { getPostsByTag } from '@/lib/firestore';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function TagPage() {
  const { tag } = useParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, [tag]);

  const fetchPosts = async () => {
    try {
      const data = await getPostsByTag(tag);
      setPosts(data);
    } catch (error) {
      toast.error('Không thể tải bài viết cho tag này');
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
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-8">
            <h1 className="text-3xl font-bold text-gray-900">#{tag}</h1>
            <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
              {posts.length} bài viết
            </span>
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-lg">Chưa có bài viết nào gắn tag này.</p>
              <Link href="/blog" className="inline-block mt-4 text-blue-600 hover:underline">Quay lại Feed</Link>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <ThreadCard key={post.id} post={post} onVoteUpdate={fetchPosts} />
              ))}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
