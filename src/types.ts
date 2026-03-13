export interface Hotspot {
  id: string;
  title: string;
  url: string;
  summary: string;
  published_at: string;
  source: string;
  total_score?: number;
  platform_score?: number;
  creator_score?: number;
  content_score?: number;
  originality?: number;
  accuracy?: number;
  depth?: number;
  engagement?: number;
  neutrality?: number;
  trend_signal?: string;
  author?: string;
  author_url?: string;
  is_favorite?: boolean;
}  summary_zh?: string;
  title_zh?: string;
}
