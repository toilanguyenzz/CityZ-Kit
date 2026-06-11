'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { deleteReview, reactToReview, updateReview } from '@/lib/firestore';
import useUserRole from '@/lib/useUserRole';
import toast from 'react-hot-toast';
import RatingStars from '@/components/RatingStars';

function SingleReview({ review, locationId, onRefresh }) {
  const [showPicker, setShowPicker] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [editComment, setEditComment] = useState(review.comment || '');
  const [editRating, setEditRating] = useState(review.rating || 5);
  const [savingReview, setSavingReview] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  
  const { user, isAdmin } = useUserRole();
  const pickerRef = useRef(null);

  useEffect(() => {
    if (review.userId) {
      const fetchProfile = async () => {
        try {
          const docRef = doc(db, 'users', review.userId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          }
        } catch (error) {
          console.error('Error fetching reviewer profile:', error);
        }
      };
      fetchProfile();
    }
  }, [review.userId]);

  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPicker]);

  const handleReact = async (emoji) => {
    if (!user) return toast.error('Vui lòng đăng nhập để thả cảm xúc');
    try {
      await reactToReview(locationId, review.id, user.uid, emoji);
      onRefresh();
      setShowPicker(false);
    } catch (e) {
      toast.error('Lỗi khi thả cảm xúc');
    }
  };

  const handleDeleteReview = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhận xét này?')) return;
    try {
      await deleteReview(locationId, review.id);
      toast.success('Đã xóa nhận xét');
      onRefresh();
    } catch (e) {
      toast.error('Lỗi khi xóa nhận xét: ' + e.message);
    }
  };

  const handleSaveReviewEdit = async (e) => {
    e.preventDefault();
    if (!editComment.trim()) return toast.error('Vui lòng nhập nội dung nhận xét');
    setSavingReview(true);
    try {
      await updateReview(locationId, review.id, {
        comment: editComment.trim(),
        rating: editRating,
      });
      toast.success('Đã cập nhật nhận xét thành công!');
      setIsEditingReview(false);
      onRefresh();
    } catch (err) {
      toast.error('Lỗi khi cập nhật nhận xét: ' + err.message);
    } finally {
      setSavingReview(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const reactions = review.reactions || {};

  if (isEditingReview) {
    return (
      <form onSubmit={handleSaveReviewEdit} className="border-b pb-4 last:border-0 space-y-3 pt-2">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Chỉnh sửa nhận xét của bạn</h4>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Đánh giá sao</label>
          <div className="py-1 px-3 bg-gray-50 border border-gray-200 rounded-lg w-fit">
            <RatingStars rating={editRating} onRate={setEditRating} interactive />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Nội dung nhận xét</label>
          <textarea
            value={editComment}
            onChange={(e) => setEditComment(e.target.value)}
            rows="3"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm outline-none text-gray-700"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setIsEditingReview(false)}
            className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={savingReview}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            {savingReview ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="border-b pb-4 last:border-0 pt-3">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${review.userId}`}>
            {userProfile?.avatarUrl ? (
              <img 
                src={userProfile.avatarUrl} 
                alt={review.userName} 
                className="w-10 h-10 rounded-full object-cover border border-gray-100 hover:scale-105 transition-transform" 
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm border border-gray-100 hover:scale-105 transition-transform">
                {(review.userName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
          <div>
            <Link href={`/profile/${review.userId}`} className="font-semibold text-gray-900 hover:underline hover:text-blue-600 transition-colors block leading-tight">
              {review.userName}
            </Link>
            <div className="flex items-center mt-1">
              <span className="text-yellow-500 text-xs">★</span>
              <span className="ml-1 text-xs text-gray-500 font-medium">{review.rating}/5</span>
            </div>
          </div>
        </div>
        <span className="text-xs text-gray-400">{formatDate(review.createdAt)}</span>
      </div>
      <p className="text-gray-700 mb-3">{review.comment}</p>

      <div className="ct-comment-footer">
        <div className="ct-actions">
          {user && (review.userId === user.uid || isAdmin) && (
            <div className="flex items-center gap-2">
              {review.userId === user.uid && (
                <button
                  type="button"
                  className="ct-action-btn"
                  onClick={() => {
                    setEditComment(review.comment || '');
                    setEditRating(review.rating || 5);
                    setIsEditingReview(true);
                  }}
                  style={{ color: '#2563eb' }}
                >
                  ✏️ Sửa
                </button>
              )}
              {review.userId === user.uid && <span className="text-gray-300">|</span>}
              <button
                type="button"
                className="ct-action-btn"
                onClick={handleDeleteReview}
                style={{ color: '#ef4444' }}
              >
                🗑️ Xóa
              </button>
            </div>
          )}
          {user && (
            <div className="ct-picker-container" ref={pickerRef}>
              <button
                className="ct-action-btn"
                onClick={() => setShowPicker(!showPicker)}
              >
                😊 Cảm xúc
              </button>
              {showPicker && (
                <div className="ct-reaction-picker">
                  {['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="ct-picker-emoji"
                      onClick={() => handleReact(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reaction pills */}
        {Object.keys(reactions).some(emoji => reactions[emoji]?.length > 0) && (
          <div className="ct-reactions-list">
            {['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji) => {
              const uids = reactions[emoji] || [];
              if (uids.length === 0) return null;
              const hasReacted = uids.includes(user?.uid);
              return (
                <button
                  key={emoji}
                  className={`ct-reaction-pill ${hasReacted ? 'ct-reacted' : ''}`}
                  onClick={() => handleReact(emoji)}
                  title={hasReacted ? 'Bỏ cảm xúc' : 'Thả cảm xúc'}
                >
                  <span>{emoji}</span>
                  <span>{uids.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentSection({ reviews = [], locationId, onRefresh }) {
  if (reviews.length === 0) {
    return <p className="text-gray-500">Chưa có nhận xét nào.</p>;
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <SingleReview
          key={review.id || review.createdAt}
          review={review}
          locationId={locationId}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
