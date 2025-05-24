import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import OptimizedImage from './OptimizedImage';
import { getAnimeTitle, formatScore, getGenreColor, getCoverImage, getSourceColor } from '@/lib/anime-utils';
import type { RecommendationResult } from '@/lib/data-sources/base';

interface RecommendationCardProps {
  recommendation: RecommendationResult;
  onClick: (anime: any) => void;
  index: number;
  stripHtml: (html: string) => string;
  truncateText: (text: string, maxLength: number) => string;
}

/**
 * A specialized card component for displaying anime recommendations with confidence scores and reasoning
 */
const RecommendationCard: React.FC<RecommendationCardProps> = memo(({
  recommendation,
  onClick,
  index,
  stripHtml,
  truncateText
}) => {
  const { anime, score, reasons } = recommendation;
  const staggerDelay = Math.min(index * 0.05, 0.5);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Recommendation card clicked:", anime.id, getAnimeTitle(anime));
    
    setTimeout(() => {
      onClick(anime);
    }, 10);
  };

  // Get the top 3 reasons for the recommendation
  const topReasons = reasons
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  // Convert recommendation score to percentage
  const confidencePercentage = Math.round(score * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ 
        duration: 0.3,
        delay: staggerDelay,
        type: "tween", 
        ease: "easeOut" 
      }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className="render-optimized card-optimized gpu-layer"
      whileTap={{ scale: 0.99, transition: { duration: 0.1 } }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Select recommended anime: ${getAnimeTitle(anime)}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(anime);
        }
      }}
    >
      <Card 
        className="group cursor-pointer hover:shadow-2xl bg-white/10 border-white/20 backdrop-blur-sm card-optimized overflow-hidden pt-0"
        onClick={handleClick}
      >
        <div className="relative w-full">
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
            <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold">
              {confidencePercentage}% Match
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
            {anime.genres?.slice(0, 2).map((genre) => (
              <Badge 
                key={genre} 
                variant="secondary" 
                className={`text-xs ${getGenreColor(genre)} text-white`}
              >
                {genre}
              </Badge>
            ))}
            {anime.genres && anime.genres.length > 2 && (
              <Badge variant="outline" className="text-xs border-white/30 text-white">
                +{anime.genres.length - 2}
              </Badge>
            )}
          </div>
          
          {/* Recommendation reasons */}
          {topReasons.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-blue-300 mb-1">Similar because:</p>
              <div className="flex flex-wrap gap-1">
                {topReasons.map((reason, idx) => (
                  <Badge 
                    key={idx}
                    variant="outline" 
                    className="text-xs border-blue-400/50 text-blue-300 bg-blue-500/20"
                  >
                    {reason.value}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
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
  return prevProps.recommendation.anime.id === nextProps.recommendation.anime.id &&
         prevProps.recommendation.score === nextProps.recommendation.score;
});

export default RecommendationCard;
