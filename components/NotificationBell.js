'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { auth, onAuthStateChanged } from '@/lib/firebase';
import { subscribeToNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/notifications';
import '@/app/styles/notification.css';

function timeAgo(dateInput) {
  if (!dateInput) return '';
  const date = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('vi-VN');
}

const NOTIF_ICONS = {
  comment: '💬',
  like: '❤️',
  follow: '👤',
  badge: '🏆',
  buddy_connect: '🤝',
  repost: '🔄',
  general: '🔔',
};

export default function NotificationBell() {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Subscribe to notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const unsub = subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
    });
    return () => unsub();
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkRead = async (notifId) => {
    if (!user) return;
    await markNotificationAsRead(user.uid, notifId);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsAsRead(user.uid);
  };

  const handleNotifClick = async (notif) => {
    if (!notif.read) {
      await handleMarkRead(notif.id);
    }
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <div className="notif-bell-container" ref={dropdownRef}>
      <button
        className="notif-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Thông báo"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-bell-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <h3>Thông báo</h3>
            {unreadCount > 0 && (
              <button className="notif-mark-all-btn" onClick={handleMarkAllRead}>
                Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>

          <div className="notif-dropdown-body">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <span className="notif-empty-icon">🔔</span>
                <p>Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map(notif => {
                const content = (
                  <div
                    key={notif.id}
                    className={`notif-item ${!notif.read ? 'notif-unread' : ''}`}
                    onClick={() => handleNotifClick(notif)}
                  >
                    <div className="notif-item-avatar">
                      {notif.fromUserAvatar ? (
                        <img src={notif.fromUserAvatar} alt="" />
                      ) : (
                        <span className="notif-item-icon">{NOTIF_ICONS[notif.type] || NOTIF_ICONS.general}</span>
                      )}
                    </div>
                    <div className="notif-item-content">
                      <p className="notif-item-message">{notif.message}</p>
                      <span className="notif-item-time">{timeAgo(notif.createdAt)}</span>
                    </div>
                    {!notif.read && <span className="notif-item-dot" />}
                  </div>
                );

                if (notif.linkUrl) {
                  return (
                    <Link key={notif.id} href={notif.linkUrl} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {content}
                    </Link>
                  );
                }
                return content;
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
