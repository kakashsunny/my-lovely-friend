import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Layers, ArrowRight, Trash2, KeyRound, ExternalLink, Plus } from 'lucide-react';
import { SavedCreatorQuiz } from '../types.ts';
import { removeSavedCreatorQuiz, timeAgo } from '../utils/storage.ts';

interface MyQuizzesDrawerProps {
  savedQuizzes: SavedCreatorQuiz[];
  onClose: () => void;
  onOpenManage: (token: string) => void;
  onCreateNew: () => void;
  onRefreshQuizzes: () => void;
}

export const MyQuizzesDrawer: React.FC<MyQuizzesDrawerProps> = ({
  savedQuizzes,
  onClose,
  onOpenManage,
  onCreateNew,
  onRefreshQuizzes,
}) => {
  const [manualToken, setManualToken] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);

  const handleOpenToken = (e: React.FormEvent) => {
    e.preventDefault();
    const token = manualToken.trim();
    if (!token) {
      setTokenError('Please paste your private management token');
      return;
    }
    // Clean if someone pasted full URL
    let cleanToken = token;
    if (token.includes('/manage/')) {
      cleanToken = token.split('/manage/')[1].split('?')[0].trim();
    }
    onOpenManage(cleanToken);
  };

  const handleDeleteLocal = (token: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Remove this quiz from your device list? (The quiz itself will remain online unless deleted via dashboard)')) {
      removeSavedCreatorQuiz(token);
      onRefreshQuizzes();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg rounded-3xl bg-slate-900/95 backdrop-blur-2xl border border-purple-500/30 shadow-2xl shadow-purple-950/50 p-6 sm:p-8 text-white max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-pink-400" />
            <h2 className="font-display text-xl font-bold text-white">Your Quizzes (No-Login Tray)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-purple-200/70 mb-4 shrink-0">
          Because Bestie requires no accounts or passwords, your private management links are conveniently saved on this device.
        </p>

        {/* Quizzes List */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-2.5 my-2">
          {savedQuizzes.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-950/50 border border-white/5 text-center space-y-3">
              <p className="text-sm text-purple-300/80">No quizzes created on this browser yet.</p>
              <button
                onClick={() => {
                  onClose();
                  onCreateNew();
                }}
                className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white text-xs font-semibold shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Your First Quiz</span>
              </button>
            </div>
          ) : (
            savedQuizzes.map((q) => (
              <div
                key={q.managementToken}
                onClick={() => onOpenManage(q.managementToken)}
                className="p-4 rounded-2xl bg-slate-950/70 hover:bg-slate-950 border border-white/10 hover:border-pink-500/30 transition-all cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors truncate">
                    {q.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-purple-300/60 mt-0.5">
                    <span>Code: {q.shareCode}</span>
                    <span>•</span>
                    <span>Created {timeAgo(q.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => handleDeleteLocal(q.managementToken, e)}
                    className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Remove from device list"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-200 group-hover:bg-pink-500 group-hover:text-white text-xs font-semibold transition-all">
                    <span>Responses</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Enter token manually from another device */}
        <div className="pt-4 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300 mb-2">
            <KeyRound className="w-3.5 h-3.5 text-pink-400" />
            <span>Have a private link or token from another device?</span>
          </div>

          <form onSubmit={handleOpenToken} className="flex gap-2">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => {
                setManualToken(e.target.value);
                if (tokenError) setTokenError(null);
              }}
              placeholder="Paste private token or /manage/... link"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 focus:border-pink-500 text-xs text-white placeholder-purple-300/40 outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition-all shrink-0 cursor-pointer"
            >
              Open
            </button>
          </form>
          {tokenError && <p className="text-xs text-rose-400 mt-1">{tokenError}</p>}
        </div>
      </motion.div>
    </div>
  );
};
