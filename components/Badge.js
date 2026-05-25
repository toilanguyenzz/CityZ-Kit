export default function Badge({ name, icon }) {
  const getBadgeColor = (name) => {
    switch(name) {
      case 'Explorer': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Helper': return 'bg-green-100 text-green-800 border-green-200';
      case 'Influencer': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-full border ${getBadgeColor(name)} shadow-sm`}>
      <span className="text-lg">{icon}</span>
      <span className="font-medium text-sm">{name}</span>
    </div>
  );
}
