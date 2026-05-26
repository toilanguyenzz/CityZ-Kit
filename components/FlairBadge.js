'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function FlairBadge({ flair, type = 'post' }) {
  if (!flair) return null;

  const styles = {
    post: {
      'URGENT': 'bg-red-100 text-red-700 border-red-200',
      'SOLVED': 'bg-green-100 text-green-700 border-green-200',
      'DISCUSSION': 'bg-blue-100 text-blue-700 border-blue-200',
      'QUESTION': 'bg-purple-100 text-purple-700 border-purple-200',
      'ANNOUNCEMENT': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'REVIEW': 'bg-orange-100 text-orange-700 border-orange-200',
    },
    comment: {
      'OP': 'bg-blue-500 text-white',
      'MOD': 'bg-red-500 text-white',
      'VIP': 'bg-yellow-500 text-white',
    }
  };

  const styleClass = styles[type]?.[flair.toUpperCase()] || 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styleClass}`}>
      {flair}
    </span>
  );
}
