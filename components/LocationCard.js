import Image from 'next/image';
import Link from 'next/link';

export default function LocationCard({ location, averageRating }) {
  const getCategoryLabel = (category) => {
    switch(category) {
      case 'Food': return '🍔 Ăn uống';
      case 'Housing': return '🏠 Nhà trọ';
      case 'Cafe': return '☕ Cafe';
      default: return category;
    }
  };

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const emptyStars = 5 - fullStars;
    return (
      <div className="flex items-center">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} className="text-yellow-400">★</span>
        ))}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-300">★</span>
        ))}
        <span className="ml-1 text-sm text-gray-600">({rating})</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="relative h-48 w-full bg-gray-200">
        {location.imageUrl ? (
          <Image
            src={location.imageUrl}
            alt={location.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-200 text-gray-400">
            No image
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-800">{location.name}</h3>
          <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
            {getCategoryLabel(location.category)}
          </span>
        </div>
        <p className="text-gray-600 text-sm mb-2 line-clamp-2">{location.description}</p>
        <p className="text-gray-500 text-xs mb-3">📍 {location.address}</p>
        <div className="flex justify-between items-center">
          {renderStars(averageRating)}
          {location.reviewCount >= 3 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              ✓ Verified by Student
            </span>
          )}
        </div>
        <Link
          href={`/location/${location.id}`}
          className="mt-3 inline-block text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Xem chi tiết →
        </Link>
      </div>
    </div>
  );
}
