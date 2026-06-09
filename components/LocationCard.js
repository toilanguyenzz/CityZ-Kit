'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useTilt3D from './useTilt3D';

export default function LocationCard({ location, averageRating }) {
  const router = useRouter();
  const { ref: tiltRef, style: tiltStyle, glareStyle, isHovered } = useTilt3D({
    maxTilt: 10,
    perspective: 900,
    scale: 1.03,
    glareOpacity: 0.15,
  });

  const getCategoryLabel = (category) => {
    switch(category) {
      case 'Food': return '🍜 Ăn uống';
      case 'Housing': return '🏠 Nhà trọ';
      case 'Cafe': return '☕ Cafe';
      case 'Play': return '🎡 Vui chơi';
      case 'Other': return '🏷️ Khác';
      default: return category;
    }
  };

  const getPriceLabel = (range) => {
    const map = {
      '0-20k': 'Dưới 20k', '20-50k': '20k–50k', '50-100k': '50k–100k',
      '100-200k': '100k–200k', '200-500k': '200k–500k', '500k-1tr': '500k–1tr',
      '1tr-2tr': '1tr–2tr', '2tr-5tr': '2tr–5tr', '5tr+': 'Trên 5tr',
    };
    return map[range] || null;
  };

  const rating = parseFloat(averageRating) || 0;
  const reviewCount = location.reviewCount || 0;
  const shortAddress = (location.address || '').split(',').slice(0, 2).join(', ');
  const priceLabel = getPriceLabel(location.priceRange);

  return (
    <div ref={tiltRef} style={tiltStyle} className="location-card-3d-wrapper">
      <Link
        href={`/location/${location.id}`}
        className="group block bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-100/60 hover:border-indigo-300/60 shadow-sm hover:shadow-xl hover:shadow-indigo-100/40 transition-all duration-300 no-underline text-inherit relative"
      >
        {/* 3D Glare overlay */}
        <div style={glareStyle} />

        {/* Hover glow border */}
        <div className={`loc-card-glow ${isHovered ? 'loc-card-glow--active' : ''}`} />

        {/* Image — fixed 4:3 ratio */}
        <div className="relative overflow-hidden bg-gray-100">
          {location.imageUrl ? (
            <Image
              src={location.imageUrl}
              alt={location.name}
              width={400}
              height={300}
              className="db-card-img"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-300" style={{ aspectRatio: '4/3' }}>
              <span className="text-4xl">📍</span>
            </div>
          )}

          {/* Category badge - floating top-left */}
          <span className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm text-xs font-semibold text-gray-700 px-2 py-1 rounded-lg shadow-sm">
            {getCategoryLabel(location.category)}
          </span>

          {/* Price badge - floating bottom-left */}
          {priceLabel && (
            <span className="absolute bottom-2.5 left-2.5 bg-emerald-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
              💰 {priceLabel}
            </span>
          )}

          {/* Verified badge - floating top-right */}
          {reviewCount >= 3 && (
            <span className="absolute top-2.5 right-2.5 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
              ✓ Verified
            </span>
          )}
        </div>

        {/* Info — compact */}
        <div className="p-3.5">
          {/* Title */}
          <h3 className="text-[15px] font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors leading-tight">
            {location.name}
          </h3>

          {/* Address - short */}
          <p className="text-xs text-gray-400 mt-1 truncate">
            📍 {shortAddress || 'TP. Hồ Chí Minh'}
          </p>

          {/* Bottom row: Rating + Creator */}
          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
            <div className="flex items-center gap-1">
              <span className="text-amber-400 text-sm">★</span>
              <span className="text-sm font-bold text-gray-800">{rating > 0 ? rating : '—'}</span>
              {reviewCount > 0 && (
                <span className="text-xs text-gray-400">({reviewCount})</span>
              )}
            </div>

            {/* Creator avatar + name */}
            <div 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (location.createdBy) {
                  router.push(`/profile?uid=${location.createdBy}`);
                }
              }}
              className="flex items-center gap-1.5 max-w-[45%] cursor-pointer group/creator hover:opacity-80 transition-opacity"
              title="Xem trang cá nhân"
            >
              {location.createdByAvatar ? (
                <img src={location.createdByAvatar} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0 group-hover/creator:scale-105 transition-transform" />
              ) : (
                <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[8px] flex-shrink-0 group-hover/creator:scale-105 transition-transform">
                  {(location.createdByName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-[11px] text-gray-400 truncate group-hover/creator:text-indigo-600 group-hover/creator:underline transition-colors">
                {location.createdByName || 'Ẩn danh'}
              </span>
            </div>

          </div>
        </div>
      </Link>
    </div>
  );
}
