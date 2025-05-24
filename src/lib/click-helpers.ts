/**
 * Utility functions to debug and enhance click events
 */

/**
 * Enhanced click handler that ensures the event is correctly processed
 * @param callback The function to call when a click is detected
 * @returns A function that can be used as an onClick handler
 */
export function createEnhancedClickHandler<T>(
  callback: (data: T) => void
): (event: React.MouseEvent, data: T) => void {
  return (event: React.MouseEvent, data: T) => {
    // Prevent default browser behavior
    event.preventDefault();
    event.stopPropagation();

    // Log the click for debugging
    console.log("Enhanced click detected", { data });

    // Ensure the event is processed in the next tick
    setTimeout(() => {
      // Call the provided callback with the data
      callback(data);
    }, 10);
  };
}

/**
 * Tracks the last selected item to help debug selection issues
 */
type SelectionTracker<T> = {
  lastSelected: T | null;
  setLastSelected: (item: T) => void;
};

// Create a global selection tracker for debugging
let lastSelectedAnime: any = null;

export function trackSelection<T>(item: T): void {
  lastSelectedAnime = item;
  console.log("Selection tracked:", item);
}

export function getLastSelection<T>(): T | null {
  return lastSelectedAnime;
}

/**
 * Create a safe click handler for header components to prevent double-firing
 * and add additional debugging
 */
export function createHeaderClickHandler(
  callback: () => void
): (event: React.MouseEvent) => void {
  return (event: React.MouseEvent) => {
    // Ensure we don't have propagation issues
    event.preventDefault();
    event.stopPropagation();

    console.log("Header click detected");

    // Create a visual feedback that the click was registered
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      // Add a brief visual feedback class
      target.classList.add("header-click-feedback");

      // Remove it after animation completes
      setTimeout(() => {
        target.classList.remove("header-click-feedback");
      }, 300);
    }

    // Execute the callback with a slight delay
    setTimeout(() => {
      callback();
      console.log("Header click callback executed");
    }, 50);
  };
}
