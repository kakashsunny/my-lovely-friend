import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Trash2, Copy, Check, Clock, Heart, Share2 } from 'lucide-react';
import { QuizResponse, Question } from '../types.ts';
import { timeAgo } from '../utils/storage.ts';

interface ResponseDetailModalProps {
  response: QuizResponse;
  questions: Question[];
  onClose: () => void;
  onDeleteResponse: (responseId: string) => Promise<void>;
}

export const ResponseDetailModal: React.FC<ResponseDetailModalProps> = ({
  response,
  questions,
  onClose,
  onDeleteResponse,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Map questionId -> question text
  const questionMap = new Map(questions.map((q) => [q.id, q.text]));

  const handleCopyText = async () => {
    const textLines = [
      `💌 ${response.responderName}'s Bestie Quiz Answers:`,
      `Time: ${timeAgo(response.submittedAt)}`,
      '',
      ...response.answers.map((ans, idx) => {
        const qText = questionMap.get(ans.questionId) || `Question #${idx + 1}`;
        return `Q: ${qText}\nA: ${ans.answerText}\n`;
      }),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(textLines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn(err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${response.responderName}'s response?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDeleteResponse(response._id);
      onClose();
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl rounded-3xl bg-slate-900/95 backdrop-blur-2xl border border-pink-500/30 shadow-2xl shadow-purple-950/50 p-6 sm:p-8 text-white max-h-[90vh] flex flex-col"
      >
        {/* Top Header */}
        <div className="flex items-start justify-between pb-4 mb-4 border-b border-white/10 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">💌</span>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                {response.responderName}'s Answers 💌
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-purple-300/70 mt-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Answered {timeAgo(response.submittedAt)}</span>
              <span>•</span>
              <span className="text-pink-300 font-medium">
                {response.answers.length} answers submitted
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Answers List */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4 my-2">
          {response.answers.map((ans, idx) => {
            const qText = questionMap.get(ans.questionId) || `Question #${idx + 1}`;
            return (
              <div
                key={ans.questionId || idx}
                className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2 hover:border-pink-500/30 transition-colors"
              >
                <div className="flex items-center justify-between text-xs text-purple-300/80 font-medium">
                  <span className="font-mono text-[11px] text-pink-400">#{idx + 1}</span>
                  <span className="truncate max-w-[90%] font-semibold">{qText}</span>
                </div>

                <div className="pt-1">
                  <p className="text-base sm:text-lg font-bold text-white tracking-wide bg-gradient-to-r from-white via-pink-100 to-purple-100 bg-clip-text text-transparent break-words">
                    {ans.answerText}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Actions: Copy Summary & Delete Response */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10 shrink-0">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete response'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied 💌</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Answers</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
