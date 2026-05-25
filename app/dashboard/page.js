'use client';

import Navbar from '@/components/Navbar';
import LocationCard from '@/components/LocationCard';
import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [locations, setLocations] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  const categories = ['All', 'Food', 'Housing', 'Cafe'];

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const q = query(collection(db, 'locations'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt),
      }));
      setLocations(data);
    } catch (error) {
      toast.error('Không thể tải địa điểm');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = useMemo(() => {
    if (filter === 'All') return locations;
    return locations.filter(loc => loc.category === filter);
  }, [locations, filter]);

  const getAverageRating = (reviews = []) => {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Khám phá địa điểm</h1>
          <p className="text-gray-600">Tìm kiếm và đánh giá quán ăn, nhà trọ, quán cafe phù hợp với bạn</p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-full font-medium transition ${
                filter === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {cat === 'All' ? 'Tất cả' : cat === 'Housing' ? 'Nhà trọ' : cat === 'Cafe' ? 'Cafe' : 'Ăn uống'}
            </button>
          ))}
        </div>

        {/* Locations Grid */}
        {filteredLocations.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <p className="text-gray-500 text-lg">Chưa có địa điểm nào.</p>
            <a href="/add-location" className="inline-block mt-4 text-blue-600 hover:underline font-semibold">
              Thêm địa điểm đầu tiên
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredLocations.map(location => (
              <LocationCard
                key={location.id}
                location={location}
                averageRating={getAverageRating(location.reviews)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
