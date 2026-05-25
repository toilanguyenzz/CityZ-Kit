export default function CommentSection({ reviews = [] }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  if (reviews.length === 0) {
    return <p className="text-gray-500">Chưa có nhận xét nào.</p>;
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id || review.createdAt} className="border-b pb-4 last:border-0">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-medium text-gray-900">{review.userName}</p>
              <div className="flex items-center mt-1">
                <span className="text-yellow-500">★</span>
                <span className="ml-1 text-sm text-gray-600">{review.rating}/5</span>
              </div>
            </div>
            <span className="text-sm text-gray-500">{formatDate(review.createdAt)}</span>
          </div>
          <p className="text-gray-700">{review.comment}</p>
        </div>
      ))}
    </div>
  );
}
