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
      <div className="recommend-root">
        <Navbar />

        {/* ───── Hero Section ───── */}
        <section className="rc-hero">
          {/* Floating particles */}
          <div className="rc-particles">
            <div className="rc-particle rc-particle--1"></div>
            <div className="rc-particle rc-particle--2"></div>
            <div className="rc-particle rc-particle--3"></div>
            <div className="rc-particle rc-particle--4"></div>
            <div className="rc-particle rc-particle--5"></div>
          </div>

          <div className="rc-hero-inner">
            <div className="rc-hero-badge">
              <span className="rc-badge-dot"></span>
              AI-Powered Recommendations
            </div>
            <h1 className="rc-hero-title">
              Gợi ý <span className="rc-gradient-text">thông minh</span> dành cho bạn
            </h1>
            <p className="rc-hero-desc">
              Để AI phân tích ngân sách, sở thích và vị trí của bạn — 
              tìm ra những địa điểm phù hợp nhất trong vài giây
            </p>
          </div>
        </section>

        <main className="rc-main">
          {/* ───── Form Card ───── */}
          <div className="rc-form-card">
            <div className="rc-form-header">
              <div className="rc-form-icon">🎯</div>
              <div className="rc-form-header-text">
                <h2>Chọn tiêu chí của bạn</h2>
                <p>Điền thông tin để AI gợi ý 3 địa điểm tốt nhất</p>
              </div>
            </div>

            <div className="rc-form-body">
              <form onSubmit={handleSubmit}>
                <div className="rc-form-grid">
                  {/* Budget */}
                  <div className="rc-field">
                    <label className="rc-field-label">
                      <span className="rc-label-icon">💰</span>
                      Ngân sách (VND/tháng)
                    </label>
                    <div className="rc-select-wrap">
                      <select
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        required
                        className="rc-select"
                      >
                        <option value="">Chọn mức ngân sách</option>
                        <option value="<2M">&lt; 2 triệu</option>
                        <option value="2-4M">2 - 4 triệu</option>
                        <option value=">4M">&gt; 4 triệu</option>
                      </select>
                    </div>
                  </div>

                  {/* Food Type */}
                  <div className="rc-field">
                    <label className="rc-field-label">
                      <span className="rc-label-icon">🍜</span>
                      Loại ẩm thực yêu thích
                    </label>
                    <div className="rc-select-wrap">
                      <select
                        value={foodType}
                        onChange={(e) => setFoodType(e.target.value)}
                        required
                        className="rc-select"
                      >
                        <option value="">Chọn loại ẩm thực</option>
                        <option value="Vietnamese">Việt Nam</option>
                        <option value="Japanese">Nhật Bản</option>
                        <option value="Fast Food">Fast Food</option>
                        <option value="Seafood">Hải sản</option>
                      </select>
                    </div>
                  </div>

                  {/* District */}
                  <div className="rc-field">
                    <label className="rc-field-label">
                      <span className="rc-label-icon">📍</span>
                      Quận hiện tại
                    </label>
                    <div className="rc-select-wrap">
                      <select
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        required
                        className="rc-select"
                      >
                        <option value="">Chọn quận</option>
                        <option value="1">Quận 1</option>
                        <option value="3">Quận 3</option>
                        <option value="4">Quận 4</option>
                        <option value="5">Quận 5</option>
                        <option value="7">Quận 7</option>
                        <option value="Binh Thanh">Bình Thạnh</option>
                        <option value="Thu Duc">Thủ Đức</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="rc-submit-btn"
                >
                  {loading ? (
                    <span className="rc-btn-spinner">
                      <span className="rc-spinner-dots">
                        <span className="rc-spinner-dot"></span>
                        <span className="rc-spinner-dot"></span>
                        <span className="rc-spinner-dot"></span>
                      </span>
                      AI đang phân tích...
                    </span>
                  ) : (
                    <>
                      <span className="rc-btn-icon">✨</span>
                      Nhận gợi ý từ AI
                    </>
                  )}
                </button>
              </form>

              {/* Messages */}
              {error && (
                <div className="rc-message rc-message--error">
                  <span className="rc-message-icon">❌</span>
                  {error}
                </div>
              )}

              {infoMessage && (
                <div className="rc-message rc-message--info">
                  <span className="rc-message-icon">💡</span>
                  {infoMessage}
                </div>
              )}

              {hasSearched && recommendations.length === 0 && !infoMessage && (
                <div className="rc-message rc-message--warning">
                  <span className="rc-message-icon">🔍</span>
                  Không tìm thấy gợi ý nào phù hợp. Vui lòng thêm địa điểm mới vào hệ thống trước!
                </div>
              )}
            </div>
          </div>

          {/* ───── How it Works Steps ───── */}
          {!hasSearched && (
            <div className="rc-steps">
              <div className="rc-step">
                <div className="rc-step-num">1</div>
                <div className="rc-step-text">
                  <h4>Chọn tiêu chí</h4>
                  <p>Điền ngân sách, ẩm thực yêu thích và khu vực của bạn</p>
                </div>
              </div>
              <div className="rc-step">
                <div className="rc-step-num">2</div>
                <div className="rc-step-text">
                  <h4>AI phân tích</h4>
                  <p>Hệ thống AI sẽ so sánh và đánh giá các địa điểm phù hợp</p>
                </div>
              </div>
              <div className="rc-step">
                <div className="rc-step-num">3</div>
                <div className="rc-step-text">
                  <h4>Nhận gợi ý</h4>
                  <p>Xem top 3 địa điểm tốt nhất kèm lý do chi tiết</p>
                </div>
              </div>
            </div>
          )}

          {/* ───── Results ───── */}
          {recommendations.length > 0 && (
            <div className="rc-results">
              <div className="rc-results-header">
                <div className="rc-results-icon">🎉</div>
                <div>
                  <div className="rc-results-title">Gợi ý dành cho bạn</div>
                  <div className="rc-results-subtitle">
                    AI đã phân tích và chọn ra {recommendations.length} địa điểm phù hợp nhất
                  </div>
                </div>
              </div>

              <div className="rc-results-grid">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="rc-result-card">
                    <div className="rc-card-accent"></div>
                    <div className="rc-card-body">
                      <div className="rc-card-rank">#{idx + 1}</div>
                      <h3 className="rc-card-name">{rec.name}</h3>
                      <p className="rc-card-reason">{rec.reason}</p>
                    </div>
                    <div className="rc-card-footer">
                      <span className="rc-card-tag">
                        <span>🤖</span> AI Picked
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
