'use client';

import { useState, useEffect } from 'react';
import { auth, db, onAuthStateChanged } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { upvoteComment, downvoteComment, addCommentToPost } from '@/lib/firestore';
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

  const { user } = useUserRole();

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

  const maxDepth = 3;

  return (
    <div className={`ct-comment ${depth > 0 ? 'ct-reply' : ''}`} style={{ '--depth': depth }}>
      <div className="ct-comment-inner">
        {/* Vote column */}
        <div className="ct-vote-col">
          <button
            onClick={handleUpvote}
            disabled={voting}
            className={`ct-vote-btn ${hasUpvoted ? 'ct-voted-up' : ''}`}
            title="Upvote"
          >
            ▲
          </button>
          <span className={`ct-score ${score > 0 ? 'ct-positive' : score < 0 ? 'ct-negative' : ''}`}>
            {score}
          </span>
          <button
            onClick={handleDownvote}
            disabled={voting}
            className={`ct-vote-btn ${hasDownvoted ? 'ct-voted-down' : ''}`}
            title="Downvote"
          >
            ▼
          </button>
        </div>

        {/* Content */}
        <div className="ct-content">
          <div className="ct-meta">
            <span className="ct-avatar">
              {comment.userAvatar ? (
                <img src={comment.userAvatar} alt={comment.userName} />
              ) : (
                comment.userName?.charAt(0).toUpperCase() || 'U'
              )}
            </span>
            <span className="ct-author">{comment.userName || 'Ẩn danh'}</span>
            <span className="ct-time">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="ct-text">{comment.comment}</p>
          <div className="ct-actions">
            {depth < maxDepth && (
              <button
                className="ct-action-btn"
                onClick={() => setShowReply(!showReply)}
              >
                💬 Trả lời
              </button>
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

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="ct-empty">
          <p>💬 Hãy là người đầu tiên bình luận!</p>
        </div>
      ) : (
        <div className="ct-list">
          {comments.map((comment) => (
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
