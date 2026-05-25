export default function RatingStars({ rating, onRate, interactive = false }) {
  const handleClick = (index) => {
    if (interactive && onRate) {
      onRate(index + 1);
    }
  };

  return (
    <div className="flex">
      {[0, 1, 2, 3, 4].map((index) => (
        <span
          key={index}
          onClick={() => handleClick(index)}
          className={`${interactive ? 'cursor-pointer hover:scale-110' : ''} text-2xl`}
          style={{ color: index < rating ? '#fbbf24' : '#d1d5db' }}
        >
          ★
        </span>
      ))}
    </div>
  );
}
