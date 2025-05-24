import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, Search } from 'lucide-react';
import { Button } from './ui/button';

interface FloatingBackButtonProps {
  onClick: () => void;
  isVisible: boolean;
  label?: string;
}

const FloatingBackButton: React.FC<FloatingBackButtonProps> = ({
  onClick,
  isVisible,
  label = 'Back to Search Results'
}) => {
  // Use hardware-accelerated animations to prevent flickering
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={isVisible 
        ? { opacity: 1, scale: 1, y: 0 } 
        : { opacity: 0, scale: 0.8, y: 20 }
      }
      transition={{ 
        duration: 0.3,
        ease: "easeOut" 
      }}
      className="fixed bottom-8 right-8 z-50"
      style={{ 
        willChange: "transform",
        transform: "translateZ(0)"
      }}
    >
      <Button
        onClick={onClick}
        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full p-4 shadow-xl flex items-center gap-2 border border-white/30 backdrop-blur-sm"
        aria-label={label}
      >
        <Search className="w-5 h-5" />
        <span className="hidden md:inline">{label}</span>
      </Button>
    </motion.div>
  );
};

export default FloatingBackButton;
