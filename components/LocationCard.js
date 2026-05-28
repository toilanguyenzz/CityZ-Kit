import Image from 'next/image';
import Link from 'next/link';

export default function LocationCard({ location, averageRating }) {
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

  const rating = parseFloat(averageRating) || 0;
  const reviewCount = location.reviewCount || 0;
  const shortAddress = (location.address || '').split(',').slice(0, 2).join(', ');

  return (
    <Link
      href={`/location/${location.id}`}
      className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-indigo-200 shadow-sm hover:shadow-lg transition-all duration-300 no-underline text-inherit"
    >
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
          <div className="flex items-center gap-1.5 max-w-[45%]">
            {location.createdByAvatar ? (
              <img src={location.createdByAvatar} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[8px] flex-shrink-0">
                {(location.createdByName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-[11px] text-gray-400 truncate">
              {location.createdByName || 'Ẩn danh'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
