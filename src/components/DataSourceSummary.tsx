import React from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { getSourceColor } from '@/lib/anime-utils';
import type { AnimeData } from '@/lib/data-sources/base';

interface DataSourceSummaryProps {
  animeList: AnimeData[];
  title?: string;
}

const DataSourceSummary: React.FC<DataSourceSummaryProps> = ({ 
  animeList, 
  title = "Data Sources" 
}) => {
  // Calculate source statistics
  const sourceStats = animeList.reduce((acc, anime) => {
    const source = anime.source;
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalCount = animeList.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-blue-200 font-medium">{title}</span>
          <div className="flex items-center gap-2">
            {Object.entries(sourceStats).map(([source, count]) => {
              const percentage = Math.round((count / totalCount) * 100);
              return (
                <div key={source} className="flex items-center gap-1">
                  <Badge 
                    className={`text-xs font-semibold ${getSourceColor(source)}`}
                  >
                    {source}
                  </Badge>
                  <span className="text-xs text-gray-300">
                    {count} ({percentage}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataSourceSummary;
