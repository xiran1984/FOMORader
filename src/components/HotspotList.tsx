import React from 'react';
import { Hotspot } from '../types';
import ScoreCard from './ScoreCard';

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
          <ScoreCard key={hotspot.id} hotspot={hotspot} />
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
