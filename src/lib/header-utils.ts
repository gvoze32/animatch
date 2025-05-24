/**
 * Header interaction utilities for AniMatch
 */

/**
 * Enhance the header with improved click feedback
 * @param headerRef Reference to the header element
 */
export function setupHeaderClickFeedback(headerRef: HTMLElement): void {
  if (!headerRef) return;

  // Add visual enhancement classes
  headerRef.classList.add("has-click-feedback");

  // Add helper tooltip if needed
  if (!headerRef.querySelector(".header-tooltip")) {
    const tooltip = document.createElement("div");
    tooltip.className = "header-tooltip";
    tooltip.innerHTML = "Klik untuk kembali ke beranda";
    tooltip.style.cssText = `
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    `;
    headerRef.appendChild(tooltip);

    // Show tooltip on hover
    headerRef.addEventListener("mouseenter", () => {
      tooltip.style.opacity = "1";
    });

    headerRef.addEventListener("mouseleave", () => {
      tooltip.style.opacity = "0";
    });
  }
}

/**
 * Add animated click feedback to the header
 * @param element The element that was clicked
 */
export function addHeaderClickFeedback(element: HTMLElement): void {
  if (!element) return;

  // Add the click feedback class
  element.classList.add("header-click-feedback");

  // Create a ripple effect
  const ripple = document.createElement("span");
  ripple.className = "header-ripple";

  // Position it at the center
  ripple.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    background: rgba(96, 165, 250, 0.5);
    border-radius: 50%;
    pointer-events: none;
    animation: header-ripple 0.6s ease-out;
    z-index: -1;
  `;

  // Add it to the element
  element.appendChild(ripple);

  // Remove it after animation completes
  setTimeout(() => {
    element.classList.remove("header-click-feedback");
    ripple.remove();
  }, 600);
}
