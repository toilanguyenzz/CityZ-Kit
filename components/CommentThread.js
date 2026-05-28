'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { upvoteComment, downvoteComment, addCommentToPost, deleteComment, reactToComment } from '@/lib/firestore';
import useUserRole from '@/lib/useUserRole';
import toast from 'react-hot-toast';

function timeAgo(dateInput) {
  if (!dateInput) return '';
  const date = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

function SingleComment({ comment, postId, depth = 0, onRefresh }) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: '', avatarUrl: null });
  const [showPicker, setShowPicker] = useState(false);

  const { user, isAdmin } = useUserRole();
  const pickerRef = useRef(null);

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

  useEffect(() => {
    if (user && showReply) {
      const fetchProfile = async () => {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile({
              name: data.name || user.displayName || user.email?.split('@')[0] || 'User',
              avatarUrl: data.avatarUrl || null
            });
          } else {
            setUserProfile({
              name: user.displayName || user.email?.split('@')[0] || 'User',
              avatarUrl: null
            });
          }
        } catch (error) {
          console.error(error);
        }
      };
      fetchProfile();
    }
  }, [user, showReply]);

  const hasUpvoted = comment.upvotedBy?.includes(user?.uid);
  const hasDownvoted = comment.downvotedBy?.includes(user?.uid);
  const score = (comment.upvotes || 0) - (comment.downvotes || 0);

  const handleUpvote = async () => {
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (voting) return;
    setVoting(true);
    try {
      await upvoteComment(postId, comment.id, user.uid);
      onRefresh();
    } catch (e) {
      toast.error('Lỗi vote');
    } finally {
      setVoting(false);
    }
  };

  const handleDownvote = async () => {
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (voting) return;
    setVoting(true);
    try {
      await downvoteComment(postId, comment.id, user.uid);
      onRefresh();
    } catch (e) {
      toast.error('Lỗi vote');
    } finally {
      setVoting(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await addCommentToPost(postId, user.uid, userProfile.name || user.displayName || user.email || 'Ẩn danh', replyText.trim(), comment.id, userProfile.avatarUrl);
      setReplyText('');
      setShowReply(false);
      toast.success('Đã trả lời');
      onRefresh();
    } catch (e) {
      toast.error('Lỗi gửi trả lời');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReact = async (emoji) => {
    if (!user) return toast.error('Vui lòng đăng nhập để thả cảm xúc');
    try {
      await reactToComment(postId, comment.id, user.uid, emoji);
      onRefresh();
      setShowPicker(false);
    } catch (e) {
      toast.error('Lỗi khi thả cảm xúc');
    }
  };

  const handleDeleteComment = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;
    try {
      await deleteComment(postId, comment.id);
      toast.success('Đã xóa bình luận');
      onRefresh();
    } catch (e) {
      toast.error('Lỗi khi xóa bình luận: ' + e.message);
    }
  };

  const maxDepth = 3;
  const reactions = comment.reactions || {};

  return (
    <div className={`ct-comment ${depth > 0 ? 'ct-reply' : ''}`} style={{ '--depth': depth }}>
      <div className="ct-comment-inner">
        {/* Avatar on the left */}
        <Link href={`/profile?uid=${comment.userId}`} className="ct-avatar-link" style={{ flexShrink: 0, marginTop: '0.2rem', textDecoration: 'none' }}>
          <span className="ct-avatar">
            {comment.userAvatar ? (
              <img src={comment.userAvatar} alt={comment.userName} />
            ) : (
              comment.userName?.charAt(0).toUpperCase() || 'U'
            )}
          </span>
        </Link>

        {/* Content on the right */}
        <div className="ct-content">
          <div className="ct-meta">
            <Link href={`/profile?uid=${comment.userId}`} className="ct-author-link" style={{ textDecoration: 'none' }}>
              <span className="ct-author" style={{ cursor: 'pointer' }}>{comment.userName || 'Ẩn danh'}</span>
            </Link>
            <span className="ct-time">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="ct-text">{comment.comment}</p>
          
          <div className="ct-comment-footer">
            <div className="ct-actions">
              <button
                className={`ct-action-btn ${hasUpvoted ? 'ct-voted-up' : ''}`}
                onClick={handleUpvote}
                disabled={voting}
                style={hasUpvoted ? { color: 'var(--blog-like-color)', fontWeight: 600 } : {}}
                title={hasUpvoted ? 'Bỏ thích' : 'Thích'}
              >
                {hasUpvoted ? '❤️' : '🤍'} {comment.upvotes || 0}
              </button>
              {depth < maxDepth && (
                <button
                  className="ct-action-btn"
                  onClick={() => setShowReply(!showReply)}
                >
                  💬 Trả lời
                </button>
              )}
              {user && (comment.userId === user.uid || isAdmin) && (
                <button
                  className="ct-action-btn"
                  onClick={handleDeleteComment}
                  style={{ color: '#ef4444' }}
                >
                  🗑️ Xóa
                </button>
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

          {/* Reply form */}
          {showReply && (
            <form onSubmit={handleReply} className="ct-reply-form">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Trả lời ${comment.userName}...`}
                rows={2}
                className="ct-reply-input"
                required
              />
              <div className="ct-reply-actions">
                <button
                  type="button"
                  onClick={() => { setShowReply(false); setReplyText(''); }}
                  className="ct-cancel-btn"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="ct-submit-btn"
                >
                  {submitting ? 'Đang gửi...' : 'Gửi'}
                </button>
              </div>
            </form>
          )}

          {/* Nested replies */}
          {comment.replies?.length > 0 && (
            <div className="ct-replies">
              {comment.replies.map((reply) => (
                <SingleComment
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  depth={depth + 1}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommentThread({ comments = [], postId, onRefresh }) {
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useUserRole();
  const [userProfile, setUserProfile] = useState({ name: '', avatarUrl: null });
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'popular'

  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === 'popular') {
      const scoreA = (a.upvotes || 0) - (a.downvotes || 0);
      const scoreB = (b.upvotes || 0) - (b.downvotes || 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
    }
    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
    return (timeB || 0) - (timeA || 0);
  });

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile({
              name: data.name || user.displayName || user.email?.split('@')[0] || 'User',
              avatarUrl: data.avatarUrl || null
            });
          } else {
            setUserProfile({
              name: user.displayName || user.email?.split('@')[0] || 'User',
              avatarUrl: null
            });
          }
        } catch (error) {
          console.error(error);
        }
      };
      fetchProfile();
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return toast.error('Vui lòng đăng nhập');
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await addCommentToPost(postId, user.uid, userProfile.name || user.displayName || user.email || 'Ẩn danh', newComment.trim(), null, userProfile.avatarUrl);
      setNewComment('');
      toast.success('Đã thêm bình luận');
      onRefresh();
    } catch (e) {
      toast.error('Lỗi gửi bình luận');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ct-root">
      {/* New comment form */}
      <form onSubmit={handleSubmit} className="ct-new-comment">
        <div className="ct-new-avatar">
          {userProfile.avatarUrl ? (
            <img src={userProfile.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            userProfile.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'
          )}
        </div>
        <div className="ct-new-input-wrap">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Chia sẻ ý kiến của bạn..."
            rows={2}
            className="ct-new-input"
            required
          />
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="ct-new-submit"
          >
            {submitting ? '...' : '➤'}
          </button>
        </div>
      </form>

      {/* Sorting bar */}
      {comments.length > 0 && (
        <div className="ct-sort-bar">
          <button
            type="button"
            className={`ct-sort-btn ${sortBy === 'newest' ? 'active' : ''}`}
            onClick={() => setSortBy('newest')}
          >
            Mới nhất
          </button>
          <button
            type="button"
            className={`ct-sort-btn ${sortBy === 'popular' ? 'active' : ''}`}
            onClick={() => setSortBy('popular')}
          >
            Phổ biến nhất
          </button>
        </div>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="ct-empty">
          <p>💬 Hãy là người đầu tiên bình luận!</p>
        </div>
      ) : (
        <div className="ct-list">
          {sortedComments.map((comment) => (
            <SingleComment
              key={comment.id}
              comment={comment}
              postId={postId}
              depth={0}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
