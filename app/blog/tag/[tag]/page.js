'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
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
                      <p className="text-gray-600 text-sm leading-relaxed line-clamp-3 mb-4">
                        {post.content}
                      </p>
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
              ))}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
