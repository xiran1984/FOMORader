import React from 'react';
import { Hotspot } from '../types';
import { ExternalLink, TrendingUp, Calendar, Hash } from 'lucide-react';

interface ScoreCardProps {
  hotspot: Hotspot;
}

const ScoreCard: React.FC<ScoreCardProps> = ({ hotspot }) => {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAuthorUrl = (hotspot: Hotspot) => {
    // If we have explicit author_url from DB (LLM extracted), use it
    if (hotspot.author_url) return hotspot.author_url;

    // Fallback: If source is X, try to extract username from source_url (only if available in type, currently source_url is not in frontend type, but logic is here)
    // Since we don't pass source_url to frontend in previous steps, we rely on author_url from DB or source name if it looks like a handle
    if (hotspot.source === 'X') {
       // logic can be improved if we passed source_url to frontend
       return null;
    }
    return null;
  };

  const displayAuthor = hotspot.author || hotspot.source;
  const authorUrl = getAuthorUrl(hotspot);

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
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 border border-gray-100 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <a 
          href={hotspot.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-lg font-semibold text-gray-800 line-clamp-2 hover:text-purple-600 hover:underline transition-colors cursor-pointer z-10 relative"
          title={hotspot.title}
          onClick={(e) => e.stopPropagation()}
        >
          {hotspot.title_zh || hotspot.title}
        </a>
        {typeof hotspot.total_score === 'number' && (
          <div className={`text-xl font-bold ${getScoreColor(hotspot.total_score)}`}>
            {hotspot.total_score.toFixed(1)}
          </div>
        )}
      </div>
      
      <p className="text-gray-600 text-sm mb-3 line-clamp-3">
        {hotspot.summary_zh || hotspot.summary}
      </p>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          {authorUrl ? (
            <a 
              href={authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-100 px-2 py-1 rounded capitalize hover:bg-purple-100 hover:text-purple-700 transition-colors cursor-pointer"
              title="Visit Author Profile"
            >
              @{displayAuthor}
            </a>
          ) : (
            <span className="bg-gray-100 px-2 py-1 rounded capitalize">
              {displayAuthor}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(hotspot.published_at)}
          </span>
        </div>
      </div>

      {hotspot.trend_signal && (
        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-purple-600">
          <TrendingUp size={12} />
          <span className="capitalize">{hotspot.trend_signal}</span>
        </div>
      )}
    </div>
  );
};

export default ScoreCard;
