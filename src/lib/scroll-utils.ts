// A utility function to create a debounced version of a function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

// A utility to throttle a function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// A utility to prevent scrolling jank by disabling animations temporarily
export function smoothScroll(
  element: HTMLElement | null,
  options?: ScrollToOptions
): void {
  if (!element) return;

  // Temporarily disable animations
  document.body.classList.add("disable-animations");

  // Get element position
  const rect = element.getBoundingClientRect();
  const top = rect.top + window.pageYOffset;

  // Perform scroll
  window.scrollTo({
    top: options?.top ?? top - 50,
    behavior: options?.behavior ?? "smooth",
  });

  // Re-enable animations after scrolling
  setTimeout(() => {
    document.body.classList.remove("disable-animations");
  }, 500);
}

// Intersection Observer utility for lazy loading
export function createIntersectionObserver(
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
): IntersectionObserver {
  return new IntersectionObserver(callback, {
    root: options?.root ?? null,
    rootMargin: options?.rootMargin ?? "0px",
    threshold: options?.threshold ?? 0.1,
  });
}

// Cache for images to prevent flickering on re-renders
export const imageCache = new Map<string, string>();
