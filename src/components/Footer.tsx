import React from 'react';
import { Github, ExternalLink, Heart, Twitter, Instagram } from 'lucide-react';
import { FadeIn } from './Motion';

export default function Footer() {
  return (
    <footer className="w-full py-12 mt-auto backdrop-blur-sm bg-blue-950/80 border-t border-white/10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo and copyright */}
          <FadeIn delay={0.1} className="flex flex-col items-center md:items-start">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-3">
              AniMatch
            </h3>
            <p className="text-sm text-white/70 text-center md:text-left mb-3">
              © {new Date().getFullYear()} AniMatch - Your Best Anime Recommendation Platform
            </p>
            <div className="flex items-center text-white/60">
              <Heart size={14} className="mr-1.5 text-red-400" />
              <span className="text-xs">Made with love for anime community</span>
            </div>
          </FadeIn>

          {/* Quick links */}
          <FadeIn delay={0.2} className="flex flex-col items-center md:items-start">
            <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
              Quick Links
            </h4>
            <ul className="space-y-3 text-center md:text-left">
              <li>
                <a 
                  href="#" 
                  className="text-sm text-white/70 hover:text-blue-400 transition-colors flex items-center justify-center md:justify-start group"
                >
                  <ExternalLink size={14} className="mr-2 group-hover:scale-110 transition-transform" />
                  About Us
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className="text-sm text-white/70 hover:text-blue-400 transition-colors flex items-center justify-center md:justify-start group"
                >
                  <ExternalLink size={14} className="mr-2 group-hover:scale-110 transition-transform" />
                  Privacy Policy
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className="text-sm text-white/70 hover:text-blue-400 transition-colors flex items-center justify-center md:justify-start group"
                >
                  <ExternalLink size={14} className="mr-2 group-hover:scale-110 transition-transform" />
                  Terms of Service
                </a>
              </li>
            </ul>
          </FadeIn>

          {/* Connect */}
          <FadeIn delay={0.3} className="flex flex-col items-center md:items-start">
            <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
              Connect With Us
            </h4>
            <div className="flex items-center space-x-4 mb-6">
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-white/10 rounded-full hover:bg-white/20 hover:scale-110 transition-all duration-200 text-white group"
                aria-label="GitHub"
              >
                <Github size={20} className="group-hover:rotate-12 transition-transform" />
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-white/10 rounded-full hover:bg-white/20 hover:scale-110 transition-all duration-200 text-white group"
                aria-label="Twitter"
              >
                <Twitter size={20} className="group-hover:rotate-12 transition-transform" />
              </a>
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-3 bg-white/10 rounded-full hover:bg-white/20 hover:scale-110 transition-all duration-200 text-white group"
                aria-label="Instagram"
              >
                <Instagram size={20} className="group-hover:rotate-12 transition-transform" />
              </a>
            </div>
            <div className="flex items-center justify-center md:justify-start">
              <div className="text-xs flex items-center bg-gradient-to-r from-blue-600/40 to-purple-600/40 text-white/90 px-4 py-2 rounded-full backdrop-blur-sm border border-white/20">
                Built with ❤️ for Anime Fans
              </div>
            </div>
          </FadeIn>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-xs text-white/50 max-w-2xl mx-auto">
            AniMatch is an independent anime recommendation platform. 
            We respect the intellectual property rights of anime creators and distributors.
          </p>
        </div>
      </div>
    </footer>
  );
}
