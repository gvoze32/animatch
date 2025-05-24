import React from 'react';
import { Github, Twitter, Instagram, Heart, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export default function Footer() {
  return (
    <footer className="w-full mt-auto border-t border-white/10 bg-gradient-to-br from-blue-900/60 via-purple-900/60 to-indigo-900/60 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-8 flex flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-1 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent select-none">AniMatch</span>
            <Heart size={16} className="text-red-400 animate-pulse" />
          </div>
          <span className="text-sm text-white/60 font-medium">Your Personalized Anime Recommendation Platform</span>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          <Badge className="bg-blue-500/10 border-blue-500/30 text-blue-300 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Enhanced</Badge>
          <Badge variant="secondary" className="bg-green-500/10 border-green-500/30 text-green-300">Open Source</Badge>
        </div>
        <div className="flex gap-4 mt-2 mb-1">
          <a href="#" className="text-xs text-white/60 hover:text-blue-400 transition-colors">About</a>
          <a href="#" className="text-xs text-white/60 hover:text-blue-400 transition-colors">Privacy</a>
          <a href="#" className="text-xs text-white/60 hover:text-blue-400 transition-colors">Terms</a>
        </div>
        <div className="flex items-center gap-4 mb-2">
          <Button asChild variant="ghost" size="icon" className="rounded-full hover:bg-blue-500/20 transition-all">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <Github className="text-white/70 hover:text-white transition-colors" size={20} />
            </a>
          </Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full hover:bg-blue-500/20 transition-all">
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
              <Twitter className="text-white/70 hover:text-white transition-colors" size={20} />
            </a>
          </Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full hover:bg-blue-500/20 transition-all">
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <Instagram className="text-white/70 hover:text-white transition-colors" size={20} />
            </a>
          </Button>
        </div>
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-2" />
        <p className="text-xs text-white/40 text-center max-w-xl">
          © {new Date().getFullYear()} AniMatch. Built with ❤️. All rights reserved.<br />
          <span className="text-[11px] text-white/30">Contact: <a href="mailto:hello@animatch.app" className="underline hover:text-blue-300">hello@animatch.app</a></span>
        </p>
      </div>
    </footer>
  );
}
