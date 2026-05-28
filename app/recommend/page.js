'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';
import '@/app/styles/recommend.css';

export default function RecommendPage() {
  const [budget, setBudget] = useState('');
  const [foodType, setFoodType] = useState('');
  const [district, setDistrict] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage('');
    setRecommendations([]);
    setHasSearched(false);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget, foodType: foodType.toLowerCase(), district }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecommendations(data.recommendations || []);
        if (data.message) {
          setInfoMessage(data.message);
        }
        setHasSearched(true);
      } else {
        setError(data.error || 'Lỗi khi gọi AI');
      }
    } catch (err) {
      setError('Lỗi kết nối API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="recommend-root" style={{ background: 'linear-gradient(to bottom right, #f8fafc, #e0e7ff, #f3e8ff)' }}>
        <Navbar />

        <main className="rc-main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '2rem', textAlign: 'center' }}>
          <div style={{
            maxWidth: '550px',
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '2.5rem',
            padding: '3rem 2rem',
            boxShadow: '0 20px 40px rgba(99, 102, 241, 0.08)'
          }} className="db-fade-in">
            {/* Pulsing AI Robot emoji */}
            <div style={{
              fontSize: '4.5rem',
              marginBottom: '1.5rem',
              animation: 'dbPulseRing 2s infinite ease-in-out',
              display: 'inline-block'
            }}>
              🤖
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(99, 102, 241, 0.1)',
              color: '#4f46e5',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0.35rem 0.8rem',
              borderRadius: '2rem',
              marginBottom: '1.25rem'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4f46e5', animation: 'ping 1s infinite' }}></span>
              Feature Coming Soon
            </div>

            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: 900,
              color: '#1e1b4b',
              lineHeight: 1.3,
              marginBottom: '1rem',
              fontFamily: 'inherit'
            }}>
              Tính Năng Gợi Ý AI <br />
              <span style={{ background: 'linear-gradient(135deg, #4f46e5, #9333ea)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Đang Được Nâng Cấp</span>
            </h1>

            <p style={{
              fontSize: '0.9rem',
              color: '#475569',
              lineHeight: 1.6,
              marginBottom: '2rem',
              padding: '0 1rem'
            }}>
              Hệ thống gợi ý thông minh dựa trên khẩu vị, vị trí GPS và phân tích ngân sách sinh viên đang được nâng cấp lên phiên bản 2.0. Hãy quay lại sau khi tính năng hoàn thành nhé! ✨
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <Link
                href="/dashboard"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  padding: '0.8rem 1.75rem',
                  borderRadius: '1.25rem',
                  boxShadow: '0 4px 15px rgba(79, 70, 229, 0.25)',
                  transition: 'opacity 0.2s',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = 0.9}
                onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
              >
                ← Về Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
