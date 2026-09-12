import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowLeft, Rocket, Eye, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import { Question } from '../types.ts';

interface PreviewQuizModalProps {
  title: string;
  questions: Question[];
  onClose: () => void;
  onConfirmPublish: () => void;
  isPublishing: boolean;
}

export const PreviewQuizModal: React.FC<PreviewQuizModalProps> = ({
  title,
  questions,
  onClose,
  onConfirmPublish,
  isPublishing,
}) => {
  const [currentStep, setCurrentStep] = useState(0); // 0 = intro screen, 1..N = question

  const totalQuestions = questions.length;
  const isIntro = currentStep === 0;
  const currentQuestion = !isIntro ? questions[currentStep - 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-purple-500/30 shadow-2xl shadow-purple-950/50 p-6 sm:p-8 text-white overflow-hidden"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-400 animate-ping" />
            <span className="text-sm font-semibold tracking-wide text-pink-300">
              Friend's View Simulation
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Banner */}
        <div className="text-center mb-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white flex items-center justify-center gap-2">
            <span>Looks good?</span>
            <span className="text-pink-400">👀</span>
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/70 mt-1">
            This is exactly how your friends will experience “{title}”
          </p>
        </div>

        {/* Interactive Mock Card */}
        <div className="min-h-[280px] flex flex-col justify-between p-6 rounded-2xl bg-slate-950/60 border border-white/10 relative overflow-hidden mb-6">
          <AnimatePresence mode="wait">
            {isIntro ? (
              <motion.div
                key="preview-intro"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center justify-center text-center py-4 space-y-4"
              >
                <div className="text-3xl">👀</div>
                <div>
                  <h3 className="text-lg font-bold text-white">Before we start… 👀</h3>
                  <p className="text-xs text-purple-300/80 mt-0.5">What should we call you?</p>
                </div>
                <div className="w-full max-w-xs px-4 py-3 rounded-xl bg-slate-900 border border-purple-500/30 text-purple-300/60 text-sm text-center">
                  [ Enter your name ]
                </div>
                <p className="text-[11px] text-purple-400/80">
                  Ready? How well do you know them?
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`preview-q-${currentStep}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                    Question {String(currentStep).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}
                  </span>
                  <span className="text-pink-400 text-[11px]">• Required</span>
                </div>

                {/* Progress bar line */}
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-pink-500 to-purple-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${(currentStep / totalQuestions) * 100}%` }}
                  />
                </div>

                <div className="pt-2">
                  <h3 className="font-display text-lg sm:text-xl font-bold text-white">
                    {currentQuestion?.text}
                  </h3>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-purple-300/50 italic">
                  Type your answer…
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mini Stepper in Mock */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs">
            <button
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <span className="text-[11px] text-purple-300/60 font-mono">
              {isIntro ? 'Screen 0' : `${currentStep} of ${totalQuestions}`}
            </span>

            <button
              onClick={() => setCurrentStep((prev) => Math.min(totalQuestions, prev + 1))}
              disabled={currentStep === totalQuestions}
              className="flex items-center gap-1 text-pink-300 hover:text-pink-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-medium"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Primary Action Buttons: “← Edit” & “🚀 Publish Quiz” */}
        <div className="flex items-center gap-3">
          <button
            id="btn-preview-edit"
            onClick={onClose}
            disabled={isPublishing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← Edit</span>
          </button>

          <button
            id="btn-preview-publish"
            onClick={onConfirmPublish}
            disabled={isPublishing}
            className="flex-[1.5] flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-pink-500/30 hover:shadow-pink-500/50 transition-all cursor-pointer disabled:opacity-50"
          >
            {isPublishing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Publishing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Rocket className="w-4 h-4" />
                🚀 Publish Quiz
              </span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
