import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, HelpCircle, ArrowRight, AlertCircle } from 'lucide-react';

interface AnswerCodeModalProps {
  onClose: () => void;
  onSubmitCode: (code: string) => void;
}

export const AnswerCodeModal: React.FC<AnswerCodeModalProps> = ({ onClose, onSubmitCode }) => {
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inputVal.trim();
    if (!raw) {
      setError('Please paste a quiz link or enter a 7-character code');
      return;
    }

    // Extract code if user pasted a full URL like https://domain.com/q/X7K92Lm or /q/X7K92Lm
    let cleanCode = raw;
    if (raw.includes('/q/')) {
      const parts = raw.split('/q/');
      cleanCode = parts[1].split('?')[0].split('#')[0].trim();
    } else if (raw.includes('?q=')) {
      const parts = raw.split('?q=');
      cleanCode = parts[1].split('&')[0].trim();
    }

    if (cleanCode.length < 3) {
      setError('Invalid code. Please check your quiz link or code.');
      return;
    }

    onSubmitCode(cleanCode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-purple-500/30 shadow-2xl shadow-purple-950/50 p-6 sm:p-8 text-white"
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-pink-400" />
            <h2 className="font-display text-xl font-bold text-white">Answer a Friend's Quiz</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-purple-200/80 mb-6">
          Paste the quiz link your friend sent you, or type in the quiz code (e.g. <span className="font-mono text-pink-300">X7K92Lm</span>).
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              id="input-quiz-share-code"
              type="text"
              autoFocus
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. X7K92Lm or paste quiz link"
              className="w-full px-4 py-3.5 rounded-2xl bg-slate-950/80 border border-purple-500/30 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 text-white font-mono text-sm sm:text-base placeholder-purple-300/40 outline-none transition-all"
            />
            {error && (
              <p className="text-xs text-rose-400 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="btn-submit-answer-code"
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-pink-500/25 transition-all cursor-pointer"
            >
              <span>Open Quiz</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
