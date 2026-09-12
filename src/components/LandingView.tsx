import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, HelpCircle, ArrowRight, ShieldCheck, Heart, Moon, MessageSquareHeart, Zap } from 'lucide-react';
import { PlatformStats, SavedCreatorQuiz } from '../types.ts';

interface LandingViewProps {
  stats: PlatformStats | null;
  savedQuizzes: SavedCreatorQuiz[];
  onCreateQuiz: () => void;
  onAnswerQuiz: () => void;
  onOpenManageQuiz: (token: string) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  stats,
  savedQuizzes,
  onCreateQuiz,
  onAnswerQuiz,
  onOpenManageQuiz,
}) => {
  return (
    <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 md:py-16 lg:py-20 flex flex-col items-center text-center">
      {/* Top Floating Badge */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-200 text-xs sm:text-sm font-medium backdrop-blur-md shadow-lg shadow-pink-900/10 mb-5 sm:mb-6"
      >
        <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
        <span>The late-night friendship quiz</span>
        <span className="hidden xs:inline text-pink-300 font-semibold">• 100% Free & Private</span>
      </motion.div>

      {/* Hero Heading - Scaled from mobile to laptop/desktop */}
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.15] sm:leading-[1.1] max-w-4xl mb-4 sm:mb-6"
      >
        Your friends know you...
        <br />
        <span className="bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-200 bg-clip-text text-transparent">
          but HOW WELL? 👀
        </span>
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="text-sm sm:text-lg md:text-xl text-purple-100/85 max-w-xl font-normal leading-relaxed mb-6 sm:mb-10 px-2"
      >
        Create a quiz. Send it to your friends.
        <br className="hidden sm:inline" />
        {' '}See what they <span className="text-white font-medium underline decoration-pink-400/50 decoration-2 underline-offset-4">really think</span> about you.
      </motion.p>

      {/* Primary & Secondary Action CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full max-w-md sm:max-w-none mb-4"
      >
        {/* Primary: ✨ Create a Quiz */}
        <button
          id="btn-hero-create"
          onClick={onCreateQuiz}
          className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white font-semibold text-base sm:text-lg shadow-xl shadow-pink-500/30 hover:shadow-pink-500/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
        >
          <Sparkles className="w-5 h-5 text-pink-200" />
          <span>✨ Create a Quiz</span>
          <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
        </button>

        {/* Secondary: 🔗 Answer a Quiz */}
        <button
          id="btn-hero-answer"
          onClick={onAnswerQuiz}
          className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3.5 sm:py-4 rounded-2xl bg-slate-900/70 hover:bg-slate-800/90 text-purple-200 hover:text-white border border-white/15 hover:border-purple-400/40 font-medium text-base sm:text-lg backdrop-blur-xl shadow-lg transition-all cursor-pointer"
        >
          <HelpCircle className="w-5 h-5 text-purple-400" />
          <span>🔗 Answer a Quiz</span>
        </button>
      </motion.div>

      {/* Small Guarantee Text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-xs sm:text-sm text-purple-300/70 font-medium tracking-wide mb-8 sm:mb-12"
      >
        No account. No signup. Just fun.
      </motion.p>

      {/* Genuine Real-Time Platform Status from Database */}
      {stats && (
        <motion.div
          id="hero-stats-pill"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="inline-flex flex-wrap justify-center items-center gap-2.5 sm:gap-4 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-slate-950/50 border border-white/10 backdrop-blur-md text-xs sm:text-sm text-purple-200/90 mb-10 sm:mb-12 shadow-inner max-w-full"
        >
          {stats.totalQuizzes > 0 ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-500/50" />
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                <span className="font-bold text-white tracking-wide">{stats.totalQuizzes.toLocaleString()}</span>
                <span className="text-purple-200/80">
                  {stats.totalQuizzes === 1 ? 'Quiz Created' : 'Quizzes Created'}
                </span>
              </div>
              <span className="text-white/25">•</span>
              <div className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/30" />
                <span className="font-bold text-white tracking-wide">{stats.totalResponses.toLocaleString()}</span>
                <span className="text-purple-200/80">
                  {stats.totalResponses === 1 ? 'Answer Shared' : 'Answers Shared'}
                </span>
              </div>
              <span className="hidden sm:inline text-white/25">•</span>
              <div className="hidden sm:flex items-center gap-1 text-[11px] text-purple-300/70 font-medium">
                <span>🔒 100% Private</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-white font-medium">100% Private & Anonymous</span>
              <span className="text-white/20">•</span>
              <span className="text-purple-200/80">Be the first to create a quiz tonight ✨</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Saved Quizzes on This Device (Creator quick access without accounts) */}
      {savedQuizzes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="w-full max-w-xl text-left p-4 sm:p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-purple-500/20 shadow-xl mb-12"
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">🔐 Your Created Quizzes</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                Saved on this device
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {savedQuizzes.slice(0, 3).map((quiz) => (
              <div
                key={quiz.managementToken}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 transition-all group"
              >
                <div className="min-w-0 pr-3">
                  <p className="text-sm font-semibold text-slate-100 truncate group-hover:text-pink-300 transition-colors">
                    {quiz.title}
                  </p>
                  <p className="text-xs text-purple-300/60 flex items-center gap-2 mt-0.5">
                    <span>Code: {quiz.shareCode}</span>
                    <span>•</span>
                    <span>{quiz.questionsCount} questions</span>
                  </p>
                </div>
                <button
                  onClick={() => onOpenManageQuiz(quiz.managementToken)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 hover:text-white text-xs font-semibold border border-purple-500/30 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>Responses</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Feature / Vibe Highlights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.55 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full max-w-4xl text-left"
      >
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-pink-500/30 transition-all shadow-lg">
          <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-3">
            <Zap className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Instant Creation</h2>
          <p className="text-xs sm:text-sm text-purple-200/70 leading-relaxed">
            Pick 10-15 deep or chaotic questions. No logins, passwords, or emails ever.
          </p>
        </div>

        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-purple-500/30 transition-all shadow-lg">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3">
            <MessageSquareHeart className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">100% Free-Text</h2>
          <p className="text-xs sm:text-sm text-purple-200/70 leading-relaxed">
            No multiple choice bubbles. Friends type their genuine thoughts, roasts & secrets.
          </p>
        </div>

        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/10 hover:border-indigo-500/30 transition-all shadow-lg sm:col-span-2 lg:col-span-1">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Private & Secret</h2>
          <p className="text-xs sm:text-sm text-purple-200/70 leading-relaxed">
            Only your private management key unlocks answers. Never published to public feeds.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
