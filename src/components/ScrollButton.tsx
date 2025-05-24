import React from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from './ui/button';

interface ScrollButtonProps {
  onClick: () => void;
  label?: string;
}

const ScrollButton: React.FC<ScrollButtonProps> = ({
  onClick,
  label = 'View Recommendations'
}) => {
  return (
    <Button
      onClick={onClick}
      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all flex items-center gap-2 mt-4 transform hover:scale-105"
      aria-label={label}
    >
      {label}
      <ArrowDown className="w-4 h-4" />
    </Button>
  );
};

export default ScrollButton;
