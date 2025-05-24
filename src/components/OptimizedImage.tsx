import React, { useState, useEffect, memo, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { imageCache } from '@/lib/scroll-utils';

interface OptimizedImageProps {
  src: string | undefined;
  alt: string;
  className?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = memo(({
  src,
  alt,
  className = ''
}) => {
  // Provide a fallback for undefined src
  const imageSrc = src || 'https://via.placeholder.com/300x450?text=No+Image';
  // Use a smaller image if possible (optimization)
  const optimizedSrc = imageSrc.replace('/large/', '/medium/');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [cachedSrc, setCachedSrc] = useState(optimizedSrc);
  
  // Use effect to prevent re-renders when scrolling
  useEffect(() => {
    // Only update if the src changes significantly
    if (optimizedSrc !== cachedSrc) {
      setCachedSrc(optimizedSrc);
      setIsLoaded(false);
      setIsError(false);
    }
  }, [optimizedSrc, cachedSrc]);

  // Reference to avoid unnecessary re-renders
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Check if the image is cached in browser or our imageCache
  useEffect(() => {
    // Check if image is in our custom cache
    if (imageCache.has(optimizedSrc)) {
      setIsLoaded(true);
    } 
    // For images already in browser cache
    else if (imgRef.current?.complete) {
      setIsLoaded(true);
      // Save to our cache too
      imageCache.set(optimizedSrc, optimizedSrc);
    }
  }, [optimizedSrc]);

  const handleLoad = () => {
    setIsLoaded(true);
    // Save successful loads to our cache
    imageCache.set(optimizedSrc, optimizedSrc);
  };

  const handleError = () => {
    setIsError(true);
    setIsLoaded(true);
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      {!isLoaded && (
        <div className="absolute top-0 left-0 w-full h-full bg-white/10 animate-pulse skeleton-optimized" />
      )}
      {isError ? (
        <div className="absolute top-0 left-0 w-full h-full bg-gray-800 flex items-center justify-center">
          <span className="text-white">Image not available</span>
        </div>
      ) : (
        <img
          ref={imgRef}
          src={cachedSrc}
          alt={alt}
          className={`${className} ${!isLoaded ? 'invisible' : 'visible'} img-optimized`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          fetchPriority="high"
          style={{ 
            transform: 'translateZ(0)',
            willChange: 'transform, opacity',
            contain: 'paint size',
            //</div> Prevent FOUC (Flash of Unstyled Content)
            contentVisibility: isLoaded ? 'auto' : 'hidden',
            // Prevent layout shifts by forcing aspect ratio for images
            aspectRatio: className.includes('object-cover') ? '2/3' : 'auto',
          }}
        />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the src actually changes
  return prevProps.src === nextProps.src;
});

export default OptimizedImage;
