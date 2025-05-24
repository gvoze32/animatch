import React from 'react';
import { motion } from 'framer-motion';

interface ShimmerProps {
  className?: string;
  children: React.ReactNode;
}

export function Shimmer({ className = '', children }: ShimmerProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {children}
    </div>
  );
}

interface GlowCardProps {
  className?: string;
  children: React.ReactNode;
  glowColor?: string;
}

export function GlowCard({ className = '', children, glowColor = 'rgb(59, 130, 246)' }: GlowCardProps) {
  return (
    <motion.div
      className={`relative group ${className}`}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div 
        className="absolute -inset-0.5 bg-gradient-to-r opacity-0 group-hover:opacity-75 blur transition duration-1000 group-hover:duration-200"
        style={{
          background: `linear-gradient(45deg, ${glowColor}, transparent, ${glowColor})`
        }}
      />
      <div className="relative">
        {children}
      </div>
    </motion.div>
  );
}

interface FloatingElementProps {
  className?: string;
  children: React.ReactNode;
  delay?: number;
  duration?: number;
}

export function FloatingElement({ 
  className = '', 
  children, 
  delay = 0, 
  duration = 3 
}: FloatingElementProps) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -10, 0],
        rotate: [0, 1, -1, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}

interface FadeInProps {
  className?: string;
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export function FadeIn({ 
  className = '', 
  children, 
  delay = 0, 
  direction = 'up' 
}: FadeInProps) {
  const directions = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 },
  };

  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        ...directions[direction],
      }}
      animate={{
        opacity: 1,
        x: 0,
        y: 0,
      }}
      transition={{
        duration: 0.6,
        delay,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );
}

// Custom CSS for shimmer animation
const shimmerStyles = `
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = shimmerStyles;
  document.head.appendChild(style);
}
