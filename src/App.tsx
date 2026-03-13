import { useEffect, useState } from 'react';
import HotspotList from './components/HotspotList';
import RadarStream from './components/RadarStream';
import { Hotspot } from './types';
import { LayoutGrid, Zap, Radio, Clock, Settings, Save, RefreshCw } from 'lucide-react';

function App() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Callback to update favorite status in local state
  const handleToggleFavorite = (id: string, newStatus: boolean) => {
    setHotspots(prev => prev.map(h => 
      h.id === id ? { ...h, is_favorite: newStatus } : h
    ));
  };

  const [filter24h, setFilter24h] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dailyTime, setDailyTime] = useState('08:00');
  const [pushLimit, setPushLimit] = useState(10);
  const [savingTime, setSavingTime] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const fetchHotspots = () => {
    setLoading(true);
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
  };

  useEffect(() => {
    fetchHotspots();
    // Fetch current schedule config ...
    fetch('http://localhost:3000/api/config/schedule')
      .then(res => res.json())
      .then(data => {
        if (data.dailyTime) {
          const parts = data.dailyTime.split(' ');
          if (parts.length >= 3) {
            const h = parts[2].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            setDailyTime(`${h}:${m}`);
          }
        }
        if (data.pushLimit) {
            setPushLimit(data.pushLimit);
        }
      })
      .catch(console.error);
  }, []);

  const [newDataArrived, setNewDataArrived] = useState(false);

  const triggerUpdate = async () => {
    if (!confirm('This will fetch new data from X and perform LLM scoring. It may take 1-2 minutes. Continue?')) {
      return;
    }
    setTriggering(true);
    setNewDataArrived(false);
    
    // Store current latest hotspot ID to detect when new data arrives
    const latestId = hotspots.length > 0 ? hotspots[0].id : null;
    let interval: NodeJS.Timeout;

    try {
      const res = await fetch('http://localhost:3000/api/trigger/daily', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start');
      
      // Poll every 5 seconds
      interval = setInterval(async () => {
        try {
            const res = await fetch('http://localhost:3000/api/hotspots?limit=1');
            const data = await res.json();
            const newLatest = data.hotspots && data.hotspots[0];
            
            // If we found a newer hotspot than before, stop spinning!
            // Or if user had no data, and now has data
            if ((!latestId && newLatest) || (newLatest && newLatest.id !== latestId)) {
                clearInterval(interval);
                setTriggering(false);
                fetchHotspots(); // Refresh full list
                setNewDataArrived(true);
                setTimeout(() => setNewDataArrived(false), 5000); // Hide success msg after 5s
            }
        } catch (e) {
            console.error(e);
        }
      }, 5000);

      // Safety timeout 2 mins
      setTimeout(() => {
        clearInterval(interval);
        setTriggering(false);
      }, 120000);

    } catch (e) {
      alert('❌ Error starting update');
      setTriggering(false);
      if (interval) clearInterval(interval);
    }
  };

  const saveSchedule = async () => {
    setSavingTime(true);
    try {
      const res = await fetch('http://localhost:3000/api/config/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: dailyTime, limit: Number(pushLimit) })
      });
      if (res.ok) {
        alert('✅ Settings updated!');
        setShowSettings(false);
      } else {
        alert('❌ Failed to update settings');
      }
    } catch (e) {
      alert('❌ Network error');
    }
    setSavingTime(false);
  };

  const getFilteredHotspots = () => {
    let filtered = [...hotspots];
    if (filter24h) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      filtered = filtered.filter(h => {
        const pubDate = new Date(h.published_at);
        return pubDate >= oneDayAgo;
      });
    }
    return filtered.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
  };

  const topRated = getFilteredHotspots().slice(0, 20);
  // High Scorers (>= 7.0) or Favorites - protected
  const highScorers = hotspots
    .filter(h => (h.total_score || 0) >= 7.0 || h.is_favorite)
    .sort((a, b) => {
      // Favorites first? or just by score? Let's stick to score for now, but ensure favorites are included
      return (b.total_score || 0) - (a.total_score || 0);
    });
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
          <div className="flex items-center gap-4">
            {newDataArrived && (
                <span className="text-sm font-medium text-green-600 animate-fade-in-out">
                    ✨ New data arrived!
                </span>
            )}
            <button
              onClick={triggerUpdate}
              disabled={triggering}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                triggering
                  ? 'bg-blue-100 text-blue-700 cursor-wait'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
              title="Fetch new data from X"
            >
              <RefreshCw size={16} className={triggering ? 'animate-spin' : ''} />
              {triggering ? 'Updating...' : 'Update Now'}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <div className="text-sm text-gray-500 hidden md:block">
              Scanning {hotspots.length} signals
            </div>
          </div>
        </div>
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Daily Push Time:</span>
                <input 
                  type="time" 
                  value={dailyTime}
                  onChange={(e) => setDailyTime(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Items per Push:</span>
                <input 
                  type="number" 
                  min="5"
                  max="30"
                  value={pushLimit}
                  onChange={(e) => setPushLimit(Number(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-16"
                />
                <span className="text-xs text-gray-500">(5-30)</span>
              </div>

              <button
                onClick={saveSchedule}
                disabled={savingTime}
                className="flex items-center gap-1 bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 disabled:opacity-50 ml-auto md:ml-0"
              >
                <Save size={14} />
                {savingTime ? 'Saving...' : 'Save Settings'}
              </button>
              <span className="text-xs text-gray-500 md:ml-auto">
                System will fetch data 10 mins before push.
              </span>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Column 1: Latest Feed */}
            <div className="space-y-4 md:col-span-1">
              <div className="flex items-center gap-2 text-gray-700 font-semibold mb-2">
                <LayoutGrid size={20} />
                Latest Feed
              </div>
              <RadarStream hotspots={latest} title="Latest Signals" />
            </div>

            {/* Column 2: High Confidence / Radar */}
            <div className="space-y-4 md:col-span-2">
               <div className="flex items-center gap-2 text-purple-700 font-semibold mb-2">
                <Zap size={20} />
                High Confidence
              </div>
              <RadarStream 
                hotspots={topRated} 
                title="Top Rated" 
                onToggleFavorite={handleToggleFavorite}
                filter24h={filter24h}
                onToggleFilter={() => setFilter24h(!filter24h)}
              />
            </div>

            {/* Column 3: High Score Vault (>= 7.0) */}
            <div className="space-y-4 md:col-span-1">
              <div className="flex items-center gap-2 text-blue-700 font-semibold mb-2">
                <Save size={20} />
                High Score Vault
              </div>
              <RadarStream hotspots={highScorers} title="Score ≥ 7.0 or Favorites" onToggleFavorite={handleToggleFavorite} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
