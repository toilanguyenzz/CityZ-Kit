'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

export default function RecommendPage() {
  const [iframeLoading, setIframeLoading] = useState(true);

  return (
    <ProtectedRoute>
      <div className="recommend-root" style={{ background: 'linear-gradient(to bottom right, #f8fafc, #e0e7ff, #f3e8ff)', minHeight: '100vh' }}>
        <Navbar />

        <main className="rc-main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem', minHeight: 'calc(100vh - 64px)' }}>
          <div style={{
            width: '100%',
            maxWidth: '760px',
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '2rem',
            padding: '2rem 1.5rem',
            boxShadow: '0 20px 40px rgba(99, 102, 241, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }} className="db-fade-in">
            
            {/* Header info */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '3.5rem',
                marginBottom: '1rem',
                display: 'inline-block'
              }}>
                📝
              </div>

              <h1 style={{
                fontSize: '1.75rem',
                fontWeight: 900,
                color: '#1e1b4b',
                lineHeight: 1.3,
                marginBottom: '0.5rem',
                fontFamily: 'inherit'
              }}>
                Góp Ý & Phản Hồi
              </h1>

              <p style={{
                fontSize: '0.9rem',
                color: '#475569',
                lineHeight: 1.6,
                maxWidth: '560px',
                margin: '0 auto 1.5rem'
              }}>
                CityZ Kit luôn trân trọng mọi đóng góp ý kiến của các bạn để nâng cấp và hoàn thiện ứng dụng ngày càng tốt hơn. Xin chân thành cảm ơn! 💖
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link
                  href="/dashboard"
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '1rem',
                    transition: 'background 0.2s',
                    textDecoration: 'none',
                    border: '1px solid #e2e8f0'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                >
                  ← Về Dashboard
                </Link>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdoxpc78Zn3-Od7xn9SOnWa6tYgVDSXhQ6x2WG9Rnooi0VO4A/viewform?usp=sharing&ouid=109396857248025032833"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '1rem',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                    transition: 'opacity 0.2s',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = 0.9}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
                >
                  Mở trong tab mới ↗
                </a>
              </div>
            </div>

            {/* Embedded Google Form Section */}
            <div style={{
              background: '#fff',
              borderRadius: '1.25rem',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              position: 'relative',
              minHeight: '400px'
            }}>
              {iframeLoading && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fff',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    border: '3px solid #e2e8f0',
                    borderTopColor: '#4f46e5',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }}></div>
                  <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>Đang tải biểu mẫu...</span>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}
              
              <iframe
                src="https://docs.google.com/forms/d/e/1FAIpQLSdoxpc78Zn3-Od7xn9SOnWa6tYgVDSXhQ6x2WG9Rnooi0VO4A/viewform?embedded=true"
                width="100%"
                height="850"
                style={{
                  border: 'none',
                  display: iframeLoading ? 'none' : 'block'
                }}
                onLoad={() => setIframeLoading(false)}
              >
                Đang tải...
              </iframe>
            </div>

          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
