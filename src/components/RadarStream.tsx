import React, { useState } from 'react';
import { Hotspot } from '../types';
import { TrendingUp, RefreshCw, Star, Clock } from 'lucide-react';

interface RadarStreamProps {
  hotspots: Hotspot[];
  title?: string;
  className?: string;
  onToggleFavorite?: (id: string, newStatus: boolean) => void;
  // New props for time filter
  filter24h?: boolean;
  onToggleFilter?: () => void;
}

const RadarStream: React.FC<RadarStreamProps> = ({ 
  hotspots, 
  title = 'Radar Stream', 
  className = '', 
  onToggleFavorite,
  filter24h,
  onToggleFilter
}) => {
  // Sort by score descending (handled by parent mostly, but safety check)
  const sortedHotspots = [...hotspots]; 

  const handleFavoriteClick = async (e: React.MouseEvent, hotspot: Hotspot) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!onToggleFavorite) return;

    // Optimistic UI update
    const newStatus = !hotspot.is_favorite;
    onToggleFavorite(hotspot.id, newStatus);

    try {
        const res = await fetch(`http://127.0.0.1:3000/api/hotspots/${hotspot.id}/favorite`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to update favorite');
    } catch (err) {
        // Revert on failure
        onToggleFavorite(hotspot.id, !newStatus);
        console.error(err);
    }
  };

  const getAuthorUrl = (hotspot: Hotspot) => {
    // If we have explicit author_url from DB (LLM extracted), use it
    if (hotspot.author_url) return hotspot.author_url;

    // Fallback: If source is X, try to extract username from source_url
    if (hotspot.source === 'X') {
       return null;
    }
    return null;
  };

  // Format date as MM/DD HH:mm
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${m}/${day} ${h}:${min}`;
  };

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4 border-b pb-2 border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <TrendingUp size={24} className="text-purple-600" />
          {title}
        </h2>
        
        {onToggleFilter ? (
          <button
            onClick={onToggleFilter}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              filter24h 
                ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
            }`}
          >
            <Clock size={12} />
            {filter24h ? 'Last 24h' : 'All Time'}
          </button>
        ) : (
          <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-medium">
            Live
          </span>
        )}
      </div>
      
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[80vh]">
        {sortedHotspots.map((hotspot) => {
          const displayAuthor = hotspot.author || hotspot.source;
          const authorUrl = getAuthorUrl(hotspot);

          return (
            <div 
              key={hotspot.id} 
              className="group relative bg-white border-l-4 border-purple-500 shadow-sm p-3 rounded-r-lg hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start mb-1">
                <a 
                  href={hotspot.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-gray-900 line-clamp-2 hover:text-purple-700 hover:underline cursor-pointer block flex-1 mr-2"
                  title={hotspot.title}
                >
                  {hotspot.title_zh || hotspot.title}
                </a>
                
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={(e) => handleFavoriteClick(e, hotspot)}
                        className={`p-1 rounded-full transition-all ${
                            hotspot.is_favorite 
                            ? 'text-yellow-400 hover:text-yellow-500 hover:bg-yellow-50' 
                            : 'text-gray-300 hover:text-yellow-400 hover:bg-gray-50'
                        } active:scale-125`}
                        title={hotspot.is_favorite ? "Remove from favorites" : "Add to favorites"}
                    >
                        <Star size={16} fill={hotspot.is_favorite ? "currentColor" : "none"} />
                    </button>
                    <span className="text-xs font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">
                    {hotspot.total_score?.toFixed(1)}
                    </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  {hotspot.trend_signal === 'rising' && <TrendingUp size={12} className="text-green-500" />}
                  {authorUrl ? (
                    <a 
                      href={authorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-purple-700 hover:underline"
                    >
                      @{displayAuthor}
                    </a>
                  ) : (
                    <span>{displayAuthor}</span>
                  )}
                </span>
                <span>{formatDate(hotspot.published_at)}</span>
              </div>
            </div>
          );
        })}
        
        {sortedHotspots.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <RefreshCw size={32} className="mb-2 opacity-50" />
            <p>Scanning for signals...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RadarStream;
