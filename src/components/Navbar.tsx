import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Heart,
  HelpCircle,
  Layers,
  Menu,
  X,
  Home,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { ActiveView } from '../types.ts';

interface NavbarProps {
  activeView: ActiveView;
  savedQuizzesCount: number;
  onNavigateHome: () => void;
  onNavigateCreate: () => void;
  onOpenAnswerModal: () => void;
  onOpenMyQuizzes: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  savedQuizzesCount,
  onNavigateHome,
  onNavigateCreate,
  onOpenAnswerModal,
  onOpenMyQuizzes,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isCreate = activeView.type === 'create';
  const isLanding = activeView.type === 'landing';

  // Automatically close mobile menu when view changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeView]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full px-3 sm:px-6 lg:px-8 pt-2.5 sm:pt-4 pb-2 sm:pb-3 max-w-7xl mx-auto">
      <nav
        id="bestie-main-nav"
        aria-label="Main Navigation"
        className="relative flex items-center justify-between px-3.5 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-full bg-slate-900/70 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-purple-950/20 text-white transition-all"
      >
        {/* Brand Logo - Responsive sizing */}
        <button
          id="btn-nav-brand"
          onClick={() => {
            setMobileMenuOpen(false);
            onNavigateHome();
          }}
          className="flex items-center gap-2 sm:gap-2.5 group cursor-pointer focus:outline-none text-left py-0.5"
          aria-label="Bestie Home"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 p-[1.5px] shadow-lg shadow-pink-500/25 group-hover:scale-105 transition-transform duration-300">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
              <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400 fill-pink-400/30 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 font-display font-bold text-base sm:text-lg md:text-xl tracking-tight bg-gradient-to-r from-white via-pink-100 to-purple-200 bg-clip-text text-transparent">
              Bestie
              <span className="text-pink-400 text-xs sm:text-sm font-medium animate-pulse">✨</span>
            </div>
            <p className="hidden md:block text-[10px] text-purple-300/70 font-medium tracking-wide -mt-0.5">
              friendship quiz
            </p>
          </div>
        </button>

        {/* Desktop & Laptop Navigation (Hidden on small mobile screens < 640px) */}
        <div className="hidden sm:flex items-center gap-2 md:gap-3">
          {/* Home Link (when not already on landing) */}
          {!isLanding && (
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs md:text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 text-purple-300" />
              <span>Home</span>
            </button>
          )}

          {/* Answer a Quiz Button */}
          <button
            id="btn-nav-answer"
            onClick={onOpenAnswerModal}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs md:text-sm font-medium text-purple-200 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-400/40 transition-all cursor-pointer"
            title="Enter a quiz code to answer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Answer a Quiz</span>
          </button>

          {/* My Quizzes (Creator responses) */}
          <button
            id="btn-nav-my-quizzes"
            onClick={onOpenMyQuizzes}
            className="relative flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs md:text-sm font-medium text-slate-300 hover:text-white bg-slate-800/40 hover:bg-slate-800/70 border border-white/10 hover:border-pink-500/30 transition-all cursor-pointer"
            title="Your created quizzes and private responses"
          >
            <Layers className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <span className="hidden md:inline">My Quizzes</span>
            <span className="inline md:hidden">Quizzes</span>
            {savedQuizzesCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm">
                {savedQuizzesCount}
              </span>
            )}
          </button>

          {/* Create Quiz Primary CTA */}
          {!isCreate ? (
            <button
              id="btn-nav-create"
              onClick={onNavigateCreate}
              className="flex items-center gap-1.5 px-3.5 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-semibold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-400 hover:to-indigo-400 text-white shadow-md shadow-pink-500/25 hover:shadow-pink-500/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Create Quiz</span>
            </button>
          ) : (
            <button
              id="btn-nav-new-quiz-alt"
              onClick={onNavigateHome}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-purple-300/80 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Back to Home
            </button>
          )}
        </div>

        {/* Mobile Compact Controls (< 640px) */}
        <div className="flex sm:hidden items-center gap-1.5">
          {/* Quick My Quizzes Icon Button with Badge (Mobile) */}
          {savedQuizzesCount > 0 && (
            <button
              onClick={onOpenMyQuizzes}
              className="relative p-2 rounded-full text-slate-200 bg-slate-800/60 border border-white/10 hover:bg-white/10 active:scale-95 transition-transform"
              title="My Quizzes"
              aria-label="My Quizzes"
            >
              <Layers className="w-4 h-4 text-pink-400" />
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold bg-pink-500 text-white">
                {savedQuizzesCount}
              </span>
            </button>
          )}

          {/* Mobile Create Button if not on create screen */}
          {!isCreate && (
            <button
              onClick={onNavigateCreate}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-sm active:scale-95 transition-transform"
            >
              <Sparkles className="w-3 h-3" />
              <span>Create</span>
            </button>
          )}

          {/* Hamburger Menu Toggle Button */}
          <button
            id="btn-mobile-menu-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-2 rounded-full text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 transition-transform cursor-pointer focus:outline-none"
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-pink-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Collapsible Drawer Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="sm:hidden fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="sm:hidden relative z-40 mt-2 p-4 rounded-3xl bg-slate-900/95 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-purple-950/50 text-white space-y-2"
            >
              {/* Home Navigation */}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateHome();
                }}
                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-colors cursor-pointer ${
                  isLanding
                    ? 'bg-purple-500/20 text-white font-semibold border border-purple-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-300">
                    <Home className="w-4 h-4" />
                  </div>
                  <span className="text-sm">Home & Discovery</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>

              {/* Create Quiz CTA */}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateCreate();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-indigo-500/20 border border-pink-500/30 text-white font-medium hover:from-pink-500/30 hover:to-indigo-500/30 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Create a Friendship Quiz</p>
                    <p className="text-[11px] text-pink-200/70">Pick chaotic questions in 60s</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-pink-400" />
              </button>

              {/* Answer a Quiz Button */}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAnswerModal();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl text-slate-300 hover:text-white hover:bg-white/5 border border-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-300">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">Answer a Friend's Quiz</p>
                    <p className="text-[11px] text-slate-400">Enter code or paste quiz link</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>

              {/* My Quizzes Drawer */}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenMyQuizzes();
                }}
                className="w-full flex items-center justify-between p-3 rounded-2xl text-slate-300 hover:text-white hover:bg-white/5 border border-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">My Quizzes & Responses</p>
                      {savedQuizzesCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500 text-white">
                          {savedQuizzesCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">Quizzes saved on this device</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>

              {/* Footer reassurance */}
              <div className="pt-2 px-1 border-t border-white/5 flex items-center justify-between text-[11px] text-purple-300/60">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>No login or email needed</span>
                </span>
                <span>Bestie 🌙</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

