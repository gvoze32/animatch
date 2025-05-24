import { useState, useEffect, useCallback, useRef } from "react";
import { throttle } from "./scroll-utils";

interface ScrollOptions {
  scrollThreshold?: number;
  throttleDelay?: number;
  disableAnimationsDuration?: number;
}

/**
 * Custom hook to optimize scrolling performance
 * This hook helps prevent "ngeblink2" (flickering) during scrolling
 */
export default function useScrollOptimized({
  scrollThreshold = 300,
  throttleDelay = 100,
  disableAnimationsDuration = 300,
}: ScrollOptions = {}) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track scroll position with throttling to reduce calculations
  const handleScroll = useCallback(
    throttle(() => {
      setScrollPosition(window.scrollY);

      // Set scrolling flag to true
      setIsScrolling(true);

      // Clear any existing timer
      if (scrollingTimerRef.current) {
        clearTimeout(scrollingTimerRef.current);
      }

      // Set a timer to mark scrolling as finished after delay
      scrollingTimerRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, throttleDelay * 3);
    }, throttleDelay),
    [throttleDelay]
  );

  // Connect the scroll handler
  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollingTimerRef.current) {
        clearTimeout(scrollingTimerRef.current);
      }
    };
  }, [handleScroll]);

  // Enhanced utility function for smooth scrolling that prevents flickering
  const smoothScrollTo = useCallback(
    (element: HTMLElement | null, options?: ScrollToOptions) => {
      if (!element) return;

      // First, pause all potentially flickering animations before scrolling
      document.body.classList.add("disable-animations");

      // Get accurate position of the element
      const rect = element.getBoundingClientRect();
      const offsetTop = rect.top + window.pageYOffset;

      // Use a dynamic offset based on viewport height
      // This ensures we don't scroll too far on different screen sizes
      const viewportHeight = window.innerHeight;
      const dynamicOffset = Math.min(Math.max(viewportHeight * 0.15, 100), 200);

      // Calculate final position ensuring content is clearly visible
      const finalTop = options?.top ?? offsetTop - dynamicOffset;

      // Apply scroll optimization settings to reduce jank
      if (typeof window.requestAnimationFrame === "function") {
        // Use requestAnimationFrame for smoother animation
        requestAnimationFrame(() => {
          // Scroll with improved behavior
          window.scrollTo({
            top: finalTop,
            behavior: options?.behavior ?? "smooth",
          });
        });
      } else {
        // Fallback for older browsers
        window.scrollTo({
          top: finalTop,
          behavior: options?.behavior ?? "smooth",
        });
      }

      // Re-enable animations after scrolling completes
      // Use a longer duration to ensure scroll completes first
      setTimeout(() => {
        document.body.classList.remove("disable-animations");
      }, disableAnimationsDuration + 200);
    },
    [disableAnimationsDuration]
  );

  return {
    scrollPosition,
    isScrolling,
    isAboveThreshold: scrollPosition > scrollThreshold,
    smoothScrollTo,
  };
}
