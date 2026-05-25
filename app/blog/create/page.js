'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { addPost } from '@/lib/firestore';
import useUserRole from '@/lib/useUserRole';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import { compressAndToBase64 } from '@/lib/imageHelper';
import toast from 'react-hot-toast';

export default function CreatePost() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const { role, isAdmin } = useUserRole();
  const [postType, setPostType] = useState('post');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const handleImageChange = (e) => {
    if (e.target.files[0]) setImageFile(e.target.files[0]);
  };

  const addOption = () => {
    if (pollOptions.length < 5) setPollOptions([...pollOptions, '']);
  };

  const removeOption = (index) => {
    if (pollOptions.length > 2) {
      const newOptions = pollOptions.filter((_, i) => i !== index);
      setPollOptions(newOptions);
    }
  };

  const updateOption = (index, value) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      toast.error('Vui lòng đăng nhập');
      return;
    }
    setLoading(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await compressAndToBase64(imageFile);
      }

      let pollData = null;
      if (postType === 'poll') {
        pollData = {
          question: title,
          options: pollOptions.map(opt => ({ text: opt, votes: 0 }))
        };
      }

      await addPost(user.uid, user.displayName || user.email, title, content, imageUrl, role, postType, pollData);
      toast.success(isAdmin ? 'Đã đăng bài thành công!' : 'Đã gửi! Bài viết đang chờ kiểm duyệt từ Admin.');
      router.push('/blog');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Chia sẻ câu chuyện của bạn</h1>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6">
            {/* Post Type Selector */}
            <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setPostType('post')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${postType === 'post' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Bài viết
              </button>
              <button
                type="button"
                onClick={() => setPostType('poll')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${postType === 'poll' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Khảo sát
              </button>
            </div>

            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">U</div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  {postType === 'poll' ? 'Câu hỏi khảo sát' : 'Tiêu đề câu chuyện'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={postType === 'poll' ? "Ví dụ: Đề thi năm nay thế nào?" : "Ví dụ: Review môn Giải tích 1..."}
                  required
                  className="w-full px-0 py-1 border-b border-gray-200 focus:border-blue-600 outline-none text-lg font-medium transition"
                />
              </div>
            </div>

            {postType === 'post' && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Nội dung chia sẻ</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows="6"
                  placeholder="Hãy viết những điều bạn muốn chia sẻ với cộng đồng sinh viên..."
                  required
                  className="w-full px-0 py-1 border-b border-gray-200 focus:border-blue-600 outline-none resize-none text-gray-700 transition"
                />
              </div>
            )}

            {postType === 'poll' && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Các lựa chọn</label>
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Lựa chọn ${index + 1}`}
                      required
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOption}
                  className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Thêm lựa chọn
                </button>
              </div>
            )}

            <div className="bg-gray-50 rounded-2xl p-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Hình ảnh minh họa</label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-2xl cursor-pointer bg-white hover:bg-gray-50 transition">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-4.212l-1.42-1.42A4 4 0 004.43 8H12a4 4 0 004 4v4a4 4 0 004 4h4a4 4 0 004-4v-4a4 4 0 00-4-4h-4m-4 4l-4-4m4 4l4-4" />
                    </svg>
                    <p className="text-sm text-gray-500"><span className="font-semibold">Nhấp để chọn ảnh</span> hoặc kéo thả</p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-2xl transition-all transform active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-200"
            >
              {loading ? 'Đang đăng bài...' : 'Đăng lên Feed'}
            </button>
          </form>
        </main>
      </div>
    </ProtectedRoute>
  );
}
