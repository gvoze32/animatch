import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { setupHeaderClickFeedback, addHeaderClickFeedback } from '@/lib/header-utils';

/**
 * ClickableHeader Component for AnimeRecommendationApp
 * 
 * This is a properly formatted React component that wraps the header elements
 * and adds click functionality.
 */
interface ClickableHeaderProps {
  searchResults: any[];
  showSearchResults: boolean;
  selectedAnime: any | null;
  handleBackToSearch: () => void;
}

export const ClickableHeader: React.FC<ClickableHeaderProps> = ({
  searchResults,
  showSearchResults,
  selectedAnime,
  handleBackToSearch
}) => {
  // Reference to the header element for applying effects
  const headerRef = useRef<HTMLDivElement>(null);

  // Set up the header click feedback
  useEffect(() => {
    if (headerRef.current) {
      setupHeaderClickFeedback(headerRef.current);
    }
  }, []);

  return (
    <motion.div 
      ref={headerRef}
      className="text-center group relative clickable-header hover:bg-white/5 hover:backdrop-blur-sm py-4 px-6 rounded-xl cursor-pointer transition-all active:bg-white/10"
      animate={{ 
        marginBottom: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? "1.5rem" : "3rem",
        marginTop: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? "2rem" : "0rem", 
        scale: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? 0.9 : 1
      }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log("Header area clicked - navigating home");
        
        // Add visual feedback using our utility
        if (headerRef.current) {
          addHeaderClickFeedback(headerRef.current);
        }
        
        // Execute with slight delay to ensure visual feedback is seen
        setTimeout(() => handleBackToSearch(), 100);
      }}
      role="button"
      tabIndex={0}
      aria-label="Back to home"
      whileHover={{ 
        boxShadow: "0 0 30px rgba(96, 165, 250, 0.15)",
      }}
      whileTap={{ scale: 0.98 }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleBackToSearch();
        }
      }}
    >
      {/* Small home icon indicator - only visible on hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-60 transition-opacity">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" 
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
            className="text-blue-300">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </div>
      
      <motion.h1 
        className={`font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent
          hover:scale-105 active:scale-95 relative
          transition-transform duration-300 ease-out
          ${
          (searchResults.length > 0 && showSearchResults && !selectedAnime)
            ? "text-4xl md:text-5xl"
            : "text-5xl md:text-6xl"
        }`}
        animate={{ 
          fontSize: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? "2.5rem" : "3.5rem"
        }}
        whileHover={{ 
          textShadow: "0 0 15px rgba(96, 165, 250, 0.7)",
          transition: { duration: 0.2 }
        }}
        transition={{ duration: 0.4 }}
        style={{ pointerEvents: "none" }} // Make text non-clickable to avoid double clicking
      >
        AniMatch
      </motion.h1>
      
      <motion.p 
        className="text-blue-200 max-w-2xl mx-auto hover:text-blue-300"
        animate={{ 
          fontSize: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? "1rem" : "1.25rem",
          opacity: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? 0.8 : 1
        }}
        whileHover={{
          scale: 1.05
        }}
        transition={{ duration: 0.4 }}
        style={{ pointerEvents: "none" }} // Make paragraph non-clickable to avoid double clicking
      >
        Find similar anime to your favorites! Search for anime and get personalized recommendations.
      </motion.p>
    </motion.div>
  );
};

