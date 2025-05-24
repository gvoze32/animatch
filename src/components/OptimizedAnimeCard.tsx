import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import OptimizedImage from './OptimizedImage';
import { getAnimeTitle, formatScore, getGenreColor, getCoverImage, getSourceColor } from '@/lib/anime-utils';
import { createEnhancedClickHandler, trackSelection } from '@/lib/click-helpers';
import type { AnimeData } from '@/lib/data-sources/base';

interface OptimizedAnimeCardProps {
  anime: AnimeData;
  onClick: (anime: AnimeData) => void;
  index: number;
  stripHtml: (html: string) => string;
  truncateText: (text: string, maxLength: number) => string;
}

/**
 * An optimized anime card component that reduces re-renders during scrolling
 * Uses memoization and optimized image loading to prevent flickering
 */
const OptimizedAnimeCard: React.FC<OptimizedAnimeCardProps> = memo(({
  anime,
  onClick,
  index,
  stripHtml,
  truncateText
}) => {
  // Calculate staggered animation delay based on index
  const staggerDelay = Math.min(index * 0.05, 0.5);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Debugging log
    console.log("Card clicked:", anime.id, getAnimeTitle(anime));
    
    // Track this selection for debugging
    trackSelection(anime);
    
    // Force a small delay to ensure React has time to process
    setTimeout(() => {
      // Call the onClick handler passed from parent
      onClick(anime);
      
      // Debug after click
      console.log("Click handler called for", anime.id);
      
      // Add extra timeout for any UI updates
      setTimeout(() => {
        console.log("Post-click verification for", anime.id);
      }, 100);
    }, 10);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ 
        duration: 0.3,  // Reduced duration
        delay: staggerDelay,
        type: "tween", 
        ease: "easeOut" 
      }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className="render-optimized card-optimized gpu-layer"
      whileTap={{ scale: 0.99, transition: { duration: 0.1 } }}
      layout={false} 
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Select anime: ${getAnimeTitle(anime)}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(anime);
        }
      }}
      data-anime-id={anime.id} // Add data attribute for easier debugging
    >
      <Card 
        className="group cursor-pointer hover:shadow-2xl bg-white/10 border-white/20 backdrop-blur-sm card-optimized overflow-hidden pt-0"
        onClick={handleClick}
      >
        <div className="relative w-full">
          {/* Make the cover image clickable */}
          <button 
            onClick={handleClick}
            className="w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            aria-label={`Select ${getAnimeTitle(anime)}`}
          >
            <div className="relative w-full h-full overflow-hidden">
              <OptimizedImage
                src={getCoverImage(anime)}
                alt={getAnimeTitle(anime)}
                className="w-full h-64 object-cover transform group-hover:scale-105 transition-transform"
              />
            </div>
          </button>
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {anime.averageScore && (
              <Badge className="bg-yellow-500 text-black font-bold">
                ⭐ {formatScore(anime.averageScore)}
              </Badge>
            )}
            <Badge className={`text-xs font-semibold ${getSourceColor(anime.source)}`}>
              {anime.source}
            </Badge>
          </div>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg line-clamp-2">
            {getAnimeTitle(anime)}
          </CardTitle>
          <CardDescription className="text-blue-200">
            {anime.startDate?.year} • {anime.episodes ? `${anime.episodes} eps` : 'Ongoing'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1 mb-2">
            {anime.genres.slice(0, 2).map((genre) => (
              <Badge 
                key={genre} 
                variant="secondary" 
                className={`text-xs ${getGenreColor(genre)} text-white`}
              >
                {genre}
              </Badge>
            ))}
            {anime.genres.length > 2 && (
              <Badge variant="outline" className="text-xs border-white/30 text-white">
                +{anime.genres.length - 2}
              </Badge>
            )}
          </div>
          {anime.description && (
            <p className="text-gray-300 text-sm line-clamp-3">
              {truncateText(stripHtml(anime.description), 100)}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the anime ID changes
  return prevProps.anime.id === nextProps.anime.id;
});

export default OptimizedAnimeCard;
