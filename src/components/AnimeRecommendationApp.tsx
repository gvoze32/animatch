import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Loader2, Star, Calendar, Tv, AlertCircle, ArrowLeft } from 'lucide-react';
import { throttle, smoothScroll } from '@/lib/scroll-utils';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import AnimatedBackground from '@/components/AnimatedBackground';
import FloatingBackButton from '@/components/FloatingBackButton';
import ScrollButton from '@/components/ScrollButton';
import OptimizedImage from '@/components/OptimizedImage';
import OptimizedAnimeCard from '@/components/OptimizedAnimeCard';
import RecommendationCard from '@/components/RecommendationCard';
import DataSourceSummary from '@/components/DataSourceSummary';
import useScrollOptimized from '@/lib/useScrollOptimized';
import { AniMatchService } from '@/lib/animatch-service';
import type { AnimeData, RecommendationResult } from '@/lib/data-sources/base';
import { createHeaderClickHandler } from '@/lib/click-helpers';
import { ClickableHeader } from '@/lib/headerComponentTemplate';
import { getAnimeTitle, stripHtml, truncateText, formatScore, getCoverImage, getSourceColor, getGenreColor } from '@/lib/anime-utils';

export default function AnimeRecommendationApp() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [searchResults, setSearchResults] = useState<AnimeData[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<AnimeData | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [error, setError] = useState<string>('');
  const [showSearchResults, setShowSearchResults] = useState(true);
  const [includeAdultContent, setIncludeAdultContent] = useState(false); // 18+ filter (disabled by default)
  
  // Initialize the AniMatch service
  const aniMatchService = useMemo(() => new AniMatchService(), []);
  
  // References for scrolling
  const selectedAnimeRef = useRef<HTMLDivElement>(null);
  const recommendationsRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  
  // Use our custom scroll optimization hook
  const { 
    scrollPosition, 
    isScrolling, 
    isAboveThreshold,
    smoothScrollTo 
  } = useScrollOptimized({
    scrollThreshold: 200,
    throttleDelay: 50
  });

  // Add a flag to prevent multiple scrolls
  const isScrollingToSection = useRef(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError('');
    setSearchResults([]);
    setSelectedAnime(null);
    setRecommendations([]);
    setShowSearchResults(true);

    try {
      const results = await aniMatchService.searchAnime(searchQuery.trim(), { 
        perPage: 12,
        includeAdult: includeAdultContent 
      });
      setSearchResults(results);
      
      // Scroll to search results if we have results
      handleSearchComplete(results);
    } catch (err) {
      setError('Failed to search anime. Please try again.');
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchComplete = useCallback((mediaResults: AnimeData[]) => {
    if (!mediaResults.length || !searchResultsRef.current) return;
    
    // Make sure the UI is updated before scrolling
    setTimeout(() => {
      // Set the focus to the first result for accessibility
      const resultsContainer = searchResultsRef.current;
      
      if (resultsContainer) {
        // Calculate a position that ensures we can see the header, search AND results
        // With a better offset that allows for the collapsed header
        const offsetFromTop = 160; // Increased to show more of the header
        
        // Get the position of the results container
        const rect = resultsContainer.getBoundingClientRect();
        // Calculate the scroll position, ensuring we don't go negative
        // We want to keep the top part visible but move down enough to see results
        const scrollPosition = Math.max(0, window.pageYOffset + rect.top - offsetFromTop);
        
        // First disable animations to prevent flickering
        document.body.classList.add('disable-animations');
        
        // Smooth scroll to the results with enhanced settings
        window.scrollTo({
          top: scrollPosition,
          behavior: "smooth"
        });
        
        // Visual feedback - highlight effect
        resultsContainer.classList.add('search-highlight');
        
        // Focus the first result card for better accessibility
        const firstResultCard = resultsContainer.querySelector('[role="button"]');
        if (firstResultCard && firstResultCard instanceof HTMLElement) {
          setTimeout(() => {
            firstResultCard.focus({ preventScroll: true });
          }, 300);
        }
        
        // Re-enable animations and remove highlight
        setTimeout(() => {
          document.body.classList.remove('disable-animations');
          resultsContainer.classList.remove('search-highlight');
        }, 1000);
      }
    }, 400); // Slightly longer delay to ensure content is rendered
  }, []);

  const handleAnimeSelect = async (anime: AnimeData) => {
    console.log("Selecting anime:", anime.id, getAnimeTitle(anime));
    
    // Use batch updates to ensure state changes happen together
    const updateState = () => {
      // First hide search results
      setShowSearchResults(false);
      
      // Then set the selected anime in a separate cycle to ensure proper ordering
      setTimeout(() => {
        setSelectedAnime(anime);
        
        // Debug logs
        console.log("Selected anime set:", anime.id);
        console.log("showSearchResults:", false);
      }, 0);
    };
    
    // Call the state update function
    updateState();
    
    // Scroll to a position that shows the selected anime clearly
    document.body.classList.add('disable-animations');
    // Scroll to a moderate position that keeps more content visible
    window.scrollTo({ top: 150, behavior: 'smooth' });
    
    // Re-enable animations after scrolling completes
    setTimeout(() => {
      document.body.classList.remove('disable-animations');
    }, 300);
    
    // Always load/reload recommendations
    setIsLoadingRecommendations(true);
    setRecommendations([]);
    setError('');

    try {
      const recommendations = await aniMatchService.getRecommendations(anime.id);
      console.log("Loaded recommendations:", recommendations.length);
      setRecommendations(recommendations);
      
      // Only automatically scroll to recommendations if we have them
      // with a slightly longer delay to ensure content is fully rendered
      if (recommendations.length > 0) {
        setTimeout(() => {
          if (recommendationsRef.current && !isScrollingToSection.current) {
            isScrollingToSection.current = true;
            
            // Use a more targeted scroll position that keeps the selected anime partially visible
            const rect = recommendationsRef.current.getBoundingClientRect();
            const offset = 120; // Smaller offset to keep more content visible
            const targetPosition = rect.top + window.pageYOffset - offset;
            
            window.scrollTo({
              top: targetPosition,
              behavior: 'smooth'
            });
            
            setTimeout(() => {
              isScrollingToSection.current = false;
            }, 1000);
          }
        }, 600); // Increased delay for better rendering
      }
    } catch (err) {
      setError('Failed to load recommendations. Please try again.');
      console.error('Recommendations error:', err);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const handleBackToSearch = useCallback(() => {
    console.log("Header clicked: Navigating back to home");
    
    // Use a more organized state update approach
    // First disable any ongoing animations
    document.body.classList.add('disable-animations');
    
    // Create a sequential state update
    const performReset = () => {
      // Reset anime selection state
      setSelectedAnime(null);
      setRecommendations([]);
      setError('');
      
      // Show search results if they exist
      setShowSearchResults(true);
      
      console.log("App state reset successfully");
    };
    
    // Perform the reset
    performReset();
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Re-enable animations after scrolling completes with enough delay
    setTimeout(() => {
      document.body.classList.remove('disable-animations');
      console.log("Animations re-enabled");
    }, 400);
  }, []);

  const scrollToRecommendations = useCallback(() => {
    if (!recommendationsRef.current || isScrollingToSection.current) return;
    
    isScrollingToSection.current = true;
    smoothScrollTo(recommendationsRef.current);
    
    setTimeout(() => {
      isScrollingToSection.current = false;
    }, 1000);
  }, [smoothScrollTo]);

  const scrollToSearchResults = useCallback(() => {
    if (!searchResultsRef.current || isScrollingToSection.current) return;
    
    setShowSearchResults(true);
    
    isScrollingToSection.current = true;
    smoothScrollTo(searchResultsRef.current);
    
    setTimeout(() => {
      isScrollingToSection.current = false;
    }, 1000);
  }, [smoothScrollTo]);

  // Direct handler for search result clicks
  const handleSearchResultClick = useCallback((anime: AnimeData) => {
    console.log("Search result clicked directly:", anime.id);
    handleAnimeSelect(anime);
  }, []);

  // Memoize the search results to prevent unnecessary re-renders
  const memoizedSearchResults = useMemo(() => {
    if (!searchResults.length) return null;
    
    return (
      <div 
        ref={searchResultsRef} 
        className="mb-12 pt-6 pb-2 scroll-mt-32 search-results-container" 
        style={{ 
          scrollMarginTop: "10rem",
          scrollPaddingTop: "10rem",
          position: "relative",
          marginTop: "1rem"
        }}
        id="search-results"
      >
        <motion.h2 
          className="text-3xl font-bold text-white mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          Search Results
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {searchResults.map((anime, index) => (
            <OptimizedAnimeCard
              key={anime.id}
              anime={anime}
              onClick={handleSearchResultClick}
              index={index}
              stripHtml={stripHtml}
              truncateText={truncateText}
            />
          ))}
        </div>
      </div>
    );
  }, [searchResults, handleSearchResultClick]);

  // Memoize recommendations to prevent unnecessary re-renders
  const memoizedRecommendations = useMemo(() => {
    if (!recommendations.length) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {recommendations.map((rec, index) => (
          <RecommendationCard
            key={rec.anime.id}
            recommendation={rec}
            onClick={handleAnimeSelect}
            index={index}
            stripHtml={stripHtml}
            truncateText={truncateText}
          />
        ))}
      </div>
    );
  }, [recommendations, handleAnimeSelect]);

  const AnimeCardSkeleton = () => (
    <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
      <div className="space-y-3 p-4">
        <Skeleton className="h-64 w-full bg-white/20 skeleton-optimized" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-3/4 bg-white/20 skeleton-optimized" />
          <Skeleton className="h-4 w-1/2 bg-white/20 skeleton-optimized" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 bg-white/20 skeleton-optimized" />
            <Skeleton className="h-6 w-20 bg-white/20 skeleton-optimized" />
          </div>
          <Skeleton className="h-16 w-full bg-white/20 skeleton-optimized" />
        </div>
      </div>
    </Card>
  );

  const SearchSkeletons = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <AnimeCardSkeleton key={i} />
      ))}
    </div>
  );

  return (
    <AnimatedBackground className="bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex-grow scroll-optimized">      
      <motion.div 
        className="container mx-auto px-4 flex flex-col min-h-[100vh] justify-center"
        animate={{ 
          paddingTop: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? "6rem" : "2rem",
          paddingBottom: "2rem"
        }}
        transition={{ duration: 0.4 }}
      >
        {/* Header with motion animation based on search state - Entire header container is clickable */}
        <motion.div 
          className={`text-center group relative clickable-header py-4 px-6 rounded-xl transition-all active:bg-white/10
            ${searchResults.length > 0 && showSearchResults && !selectedAnime ? 'hover:bg-white/5 hover:backdrop-blur-sm cursor-pointer' : 'cursor-default'}`}
          role="button"
          tabIndex={searchResults.length > 0 && showSearchResults && !selectedAnime ? 0 : -1}
          aria-label="Back to home"
          style={{
            marginBottom: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? '1.5rem' : '3rem',
            marginTop: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? '2rem' : '0rem',
            transform: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? 'scale(0.9)' : 'scale(1)',
            boxShadow: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? '0 0 0px rgba(96, 165, 250, 0.15)' : undefined,
            pointerEvents: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? 'auto' : 'none',
          }}
          onClick={searchResults.length > 0 && showSearchResults && !selectedAnime ? (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleBackToSearch();
          } : undefined}
          onKeyDown={searchResults.length > 0 && showSearchResults && !selectedAnime ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleBackToSearch();
            }
          } : undefined}
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
              ${(searchResults.length > 0 && showSearchResults && !selectedAnime) ? 'text-4xl md:text-5xl' : 'text-5xl md:text-6xl'}`}
            style={{ pointerEvents: 'none', fontSize: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? '2.5rem' : '3.5rem' }}
          >
            AniMatch
          </motion.h1>
          <motion.p 
            className="text-blue-200 max-w-2xl mx-auto hover:text-blue-300"
            style={{ pointerEvents: 'none', fontSize: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? '1rem' : '1.25rem', opacity: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? 0.8 : 1 }}
          >
            Find similar anime to your favorites! Search for anime and get personalized recommendations.
          </motion.p>
        </motion.div>

        {/* Search Form with motion animation */}
        <motion.form 
          onSubmit={handleSearch} 
          className="max-w-2xl mx-auto"
          animate={{ 
            marginBottom: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? "2rem" : "3rem",
            marginTop: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? "0rem" : "0rem",
            scale: (searchResults.length > 0 && showSearchResults && !selectedAnime) ? 0.95 : 1
          }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg bg-white/10 border-white/20 text-white placeholder-gray-300"
              />
            </div>
            <Button 
              type="submit" 
              disabled={isSearching}
              className="h-14 px-8 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {isSearching ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Searching...</span>
                </div>
              ) : (
                'Search'
              )}
            </Button>
          </div>
        </motion.form>

        {/* Search Results with AnimatePresence for smooth transitions */}
        <AnimatePresence mode="wait">
          {isSearching ? (
            <motion.div
              key="search-skeletons"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4"
            >
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-4 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-lg border border-white/20">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                  <span className="text-white">Searching across multiple databases...</span>
                  <div className="flex gap-2">
                    <Badge className="bg-blue-500 text-white">AniList</Badge>
                    <Badge className="bg-green-500 text-white">MyAnimeList</Badge>
                    <Badge className="bg-orange-500 text-white">Kitsu</Badge>
                  </div>
                </div>
              </div>
              <SearchSkeletons />
            </motion.div>
          ) : searchResults.length > 0 && showSearchResults && !selectedAnime ? (
            <motion.div
              key="search-results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="mt-4"
            >
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                  <span className="text-blue-200">Results from multiple sources:</span>
                  <span className="text-white font-semibold">{searchResults.length} anime found</span>
                </div>
              </div>
              <div className="mb-6">
                <DataSourceSummary animeList={searchResults} title="Search Results by Source" />
              </div>
              {memoizedSearchResults}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Debug selected anime state */}
        <div className="hidden">{selectedAnime ? `Selected: ${selectedAnime.id}` : 'No selection'}</div>
        
        {/* Selected Anime & Recommendations */}
        <AnimatePresence>
          {selectedAnime && (
            <motion.div 
              className="space-y-12" 
              ref={selectedAnimeRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              key={`selected-anime-${selectedAnime.id}`}
            >
              {/* Back to Search Button */}
              <div className="flex justify-start">
                <Button
                  onClick={handleBackToSearch}
                  variant="outline"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20 transition-all"
                  aria-label="Back to Search Results"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Search Results
                </Button>
              </div>

              {/* Selected Anime Detail */}
              <div>
                <motion.h2 
                  className="text-3xl font-bold text-white mb-6"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  Selected Anime
                </motion.h2>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, type: "tween", ease: "easeOut" }}
                  className="render-optimized"
                >
                  <Card className="text-card-foreground flex flex-col gap-0 rounded-xl border shadow-sm bg-white/10 border-white/20 backdrop-blur-sm overflow-hidden card-optimized py-0">
                    <div className="md:flex">
                      <div className="md:w-1/3 relative">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.7 }}
                          className="!m-0 !p-0"
                        >
                          <OptimizedImage
                            src={getCoverImage(selectedAnime)}
                            alt={getAnimeTitle(selectedAnime)}
                            className="w-full h-96 md:h-full object-cover visible img-optimized rounded-none !m-0 !p-0"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:hidden"></div>
                        </motion.div>
                      </div>
                      <div className="md:w-2/3 p-6 pt-4 pb-4 flex flex-col justify-center">
                        <CardHeader className="p-0 mb-4">
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                          >
                            <CardTitle className="text-2xl md:text-3xl text-white font-bold">
                              {getAnimeTitle(selectedAnime)}
                            </CardTitle>
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                          >
                            <CardDescription className="text-blue-200 text-lg flex items-center flex-wrap gap-2 mt-2">
                              <span className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                {selectedAnime.startDate?.year}
                              </span>
                              <span className="flex items-center">
                                <Tv className="w-4 h-4 mr-1" />
                                {selectedAnime.episodes ? `${selectedAnime.episodes} episodes` : 'Ongoing'}
                              </span>
                              {selectedAnime.averageScore && (
                                <span className="flex items-center text-yellow-400 font-bold">
                                  <Star className="w-4 h-4 mr-1" />
                                  {formatScore(selectedAnime.averageScore)}
                                </span>
                              )}
                              <Badge className={`text-sm font-semibold ${getSourceColor(selectedAnime.source)}`}>
                                From {selectedAnime.source}
                              </Badge>
                            </CardDescription>
                          </motion.div>
                        </CardHeader>
                        <motion.div 
                          className="space-y-4"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5, delay: 0.4 }}
                        >
                          <div className="flex flex-wrap gap-2">
                            {selectedAnime.genres.map((genre, idx) => (
                              <motion.div
                                key={genre}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3, delay: 0.4 + (idx * 0.05) }}
                              >
                                <Badge className={`${getGenreColor(genre)} text-white`}>
                                  {genre}
                                </Badge>
                              </motion.div>
                            ))}
                          </div>
                          {selectedAnime.description && (
                            <motion.p 
                              className="text-gray-300 leading-relaxed"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.5, delay: 0.6 }}
                            >
                              {stripHtml(selectedAnime.description)}
                            </motion.p>
                          )}
                          {/* Button to scroll to recommendations */}
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.7 }}
                          >
                            <ScrollButton onClick={scrollToRecommendations} />
                          </motion.div>
                        </motion.div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </div>

              {/* Recommendations */}
              <div ref={recommendationsRef} className="content-viz">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-3xl font-bold text-white">
                    AI-Powered Recommendations
                    {isLoadingRecommendations && (
                      <Loader2 className="inline-block ml-4 w-8 h-8 animate-spin" />
                    )}
                  </h2>
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-3 py-1">
                    🤖 AI Enhanced
                  </Badge>
                </div>
                
                {isLoadingRecommendations && (
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-4 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-lg border border-white/20">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                      <span className="text-white">Analyzing preferences and finding similar anime...</span>
                    </div>
                  </div>
                )}
                
                {recommendations.length > 0 ? (
                  <>
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                        <span className="text-purple-200">Found {recommendations.length} personalized recommendations</span>
                      </div>
                    </div>
                    <div className="mb-6">
                      <DataSourceSummary 
                        animeList={recommendations.map(rec => rec.anime)} 
                        title="Recommendations by Source" 
                      />
                    </div>
                    {memoizedRecommendations}
                  </>
                ) : !isLoadingRecommendations && (
                  <Card className="bg-white/10 border-white/20">
                    <CardContent className="p-8 text-center">
                      <p className="text-gray-300 text-lg">
                        No recommendations found for this anime.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      {/* 18+ Content Filter Toggle dipindahkan ke bawah */}
      <div className="w-full flex justify-center mt-8 mb-2">
        <label className="flex items-center gap-3 text-white/50 hover:text-white/70 cursor-pointer transition-colors text-xs">
          <input
            type="checkbox"
            checked={includeAdultContent}
            onChange={(e) => setIncludeAdultContent(e.target.checked)}
            className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-500 focus:ring-2 focus:ring-offset-0"
          />
          <span className="select-none">Include 18+ content</span>
        </label>
      </div>
    </AnimatedBackground>
  );
}
