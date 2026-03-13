import React from 'react';
import { Hotspot } from '../types';

interface HotspotListProps {
  hotspots: Hotspot[];
  title?: string;
  className?: string;
}

const HotspotList: React.FC<HotspotListProps> = ({ hotspots, title = 'Hotspots', className = '' }) => {
  return (
    <div className={`p-4 ${className}`}>
      <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2 border-gray-200">
        {title} <span className="text-sm font-normal text-gray-500">({hotspots.length})</span>
      </h2>
      <div className="flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
        {hotspots.map((hotspot) => (
          <div key={hotspot.id} className="p-4 border rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-lg mb-2">{hotspot.title}</h3>
            <p className="text-gray-600 text-sm line-clamp-3">{hotspot.summary}</p>
            <div className="mt-3 flex justify-between items-center text-xs text-gray-500">
              <span>{hotspot.published_at ? new Date(hotspot.published_at).toLocaleDateString() : 'Unknown Date'}</span>
              <span className="bg-gray-100 px-2 py-1 rounded">{hotspot.source}</span>
            </div>
          </div>
        ))}
        {hotspots.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No hotspots found
          </div>
        )}
      </div>
    </div>
  );
};

export default HotspotList;
