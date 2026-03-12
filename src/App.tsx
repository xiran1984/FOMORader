import { useEffect, useState } from 'react';
import HotspotList from './components/HotspotList';
import RadarStream from './components/RadarStream';
import { Hotspot } from './types';
import { LayoutGrid, Zap, Radio } from 'lucide-react';

function App() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/api/hotspots?limit=100')
      .then(res => res.json())
      .then(data => {
        setHotspots(data.hotspots || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch hotspots:', err);
        setLoading(false);
      });
  }, []);

  const topRated = [...hotspots]
    .sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
    .slice(0, 20);
  const trending = hotspots.filter(h => h.trend_signal === 'rising');
  // latest is just the raw list, as API returns sorted by published_at desc
  const latest = hotspots;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="text-purple-600" />
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-500">
              FOMORader
            </h1>
          </div>
          <div className="text-sm text-gray-500">
            Scanning {hotspots.length} signals
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: Latest Feed */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-700 font-semibold mb-2">
                <LayoutGrid size={20} />
                Latest Feed
              </div>
              <HotspotList hotspots={latest} title="Latest Signals" />
            </div>

            {/* Column 2: High Confidence / Radar */}
            <div className="space-y-4 md:col-span-2">
               <div className="flex items-center gap-2 text-purple-700 font-semibold mb-2">
                <Zap size={20} />
                High Confidence
              </div>
              <RadarStream hotspots={topRated} title="Top Rated" />
            </div>

            {/* Column 3: Trending / Analysis (Hidden) */}
            {/* <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-700 font-semibold mb-2">
                <Radio size={20} />
                Trending Now
              </div>
              <RadarStream hotspots={trending} title="Rising Trends" />
            </div> */}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
