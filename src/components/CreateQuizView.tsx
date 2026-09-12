import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Smile,
  Rocket,
  Eye,
  AlertCircle,
  HelpCircle,
  Wand2,
  CheckCircle2,
} from 'lucide-react';
import { Question } from '../types.ts';
import { DEFAULT_INITIAL_QUESTIONS, PRESET_CATEGORIES } from '../data/presetQuestions.ts';
import { PreviewQuizModal } from './PreviewQuizModal.tsx';
import { safeFetchJson } from '../utils/api.ts';

interface CreateQuizViewProps {
  onPublishSuccess: (data: { shareCode: string; managementToken: string; title: string; questionsCount: number }) => void;
  onCancel: () => void;
}

const COMMON_EMOJIS = ['💜', '👀', '🥹', '💌', '🚗', '🫂', '🌎', '😂', '🍜', '✨', '🔥', '❤️', '🍿', '🎧', '✈️', '💀'];

export const CreateQuizView: React.FC<CreateQuizViewProps> = ({ onPublishSuccess, onCancel }) => {
  const [title, setTitle] = useState('How Well Do You Know Me? 💜');
  const [questions, setQuestions] = useState<Question[]>(() =>
    DEFAULT_INITIAL_QUESTIONS.map((text, idx) => ({
      id: `q_${idx + 1}_${Date.now()}`,
      text,
      position: idx + 1,
      required: true,
    }))
  );

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick Emoji Append
  const handleAddEmojiToQuestion = (questionId: string, emoji: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, text: `${q.text} ${emoji}`.trim() } : q))
    );
  };

  // Update question text
  const handleUpdateText = (questionId: string, newText: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, text: newText } : q))
    );
    if (errorMessage) setErrorMessage(null);
  };

  // Add Question
  const handleAddBlankQuestion = () => {
    const newId = `q_${questions.length + 1}_${Date.now()}`;
    const newQuestion: Question = {
      id: newId,
      text: '',
      position: questions.length + 1,
      required: true,
    };
    setQuestions((prev) => [...prev, newQuestion]);
  };

  // Add Preset Question
  const handleAddPreset = (text: string) => {
    // Check if already added
    if (questions.some((q) => q.text.toLowerCase().trim() === text.toLowerCase().trim())) {
      return;
    }
    const newId = `q_${questions.length + 1}_${Date.now()}`;
    const newQuestion: Question = {
      id: newId,
      text,
      position: questions.length + 1,
      required: true,
    };
    setQuestions((prev) => [...prev, newQuestion]);
  };

  // Duplicate Question
  const handleDuplicate = (index: number) => {
    const target = questions[index];
    const duplicated: Question = {
      id: `q_dup_${Date.now()}`,
      text: target.text,
      position: index + 2,
      required: true,
    };
    const updated = [...questions];
    updated.splice(index + 1, 0, duplicated);
    // update positions
    setQuestions(updated.map((q, idx) => ({ ...q, position: idx + 1 })));
  };

  // Delete Question
  const handleDelete = (questionId: string) => {
    if (questions.length <= 1) {
      setErrorMessage('Your quiz must have at least 1 question.');
      return;
    }
    setQuestions((prev) =>
      prev.filter((q) => q.id !== questionId).map((q, idx) => ({ ...q, position: idx + 1 }))
    );
  };

  // Move Up / Down
  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const list = [...questions];
    const [moved] = list.splice(index, 1);
    list.splice(targetIdx, 0, moved);

    setQuestions(list.map((q, idx) => ({ ...q, position: idx + 1 })));
  };

  // Validation
  const validateQuiz = (): boolean => {
    if (!title.trim()) {
      setErrorMessage('Please provide a title for your quiz ✨');
      return false;
    }
    if (questions.length === 0) {
      setErrorMessage('Please add at least 1 question to your quiz.');
      return false;
    }
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim()) {
        setErrorMessage(`Question #${i + 1} is empty. Please enter text or delete it.`);
        return false;
      }
    }
    setErrorMessage(null);
    return true;
  };

  // Publish
  const handlePublish = async () => {
    if (!validateQuiz()) return;

    setIsPublishing(true);
    setErrorMessage(null);

    try {
      const { ok, data, error } = await safeFetchJson<{
        success: boolean;
        shareCode: string;
        managementToken: string;
        error?: string;
      }>('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          questions: questions.map((q, idx) => ({
            id: q.id,
            text: q.text.trim(),
            position: idx + 1,
            required: true,
          })),
        }),
      });

      if (!ok || !data?.success) {
        throw new Error(error || data?.error || 'Failed to publish quiz. Please try again.');
      }

      onPublishSuccess({
        shareCode: data.shareCode,
        managementToken: data.managementToken,
        title: title.trim(),
        questionsCount: questions.length,
      });
    } catch (err: any) {
      console.error('Publish error:', err);
      setErrorMessage(err.message || 'Unable to publish quiz. Please try again in a moment.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-3xl mx-auto px-4 py-8 text-white">
      {/* Page Title */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-3"
        >
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span>No Account Needed • Ready to Share</span>
        </motion.div>
        <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Create your quiz ✨
        </h1>
        <p className="text-xs sm:text-sm text-purple-200/70 mt-2 max-w-md mx-auto">
          Add 10–15 personal questions. Friends will write real free-text answers just for your eyes.
        </p>
      </div>

      {/* Main Container */}
      <div className="space-y-6">
        {/* Quiz Title Box */}
        <div className="p-6 rounded-3xl bg-slate-900/70 backdrop-blur-xl border border-white/10 shadow-2xl">
          <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300 mb-2">
            Quiz Title 💜
          </label>
          <input
            id="input-quiz-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="How Well Do You Know Me? 💜"
            maxLength={100}
            className="w-full px-4 py-3.5 rounded-2xl bg-slate-950/80 border border-purple-500/30 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 text-white font-display text-lg sm:text-xl font-bold placeholder-purple-300/40 outline-none transition-all"
          />
          <div className="flex items-center justify-between text-[11px] text-purple-300/60 mt-2 px-1">
            <span>This title appears at the top of your public quiz</span>
            <span>{title.length}/100</span>
          </div>
        </div>

        {/* Suggestion Categories Drawer */}
        <div className="p-5 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-purple-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-pink-400" />
              <span className="text-xs sm:text-sm font-bold text-white">
                Need question ideas? Tap to add instantly ✨
              </span>
            </div>
            <span className="text-[11px] text-purple-300/70">
              {questions.length} / 10–15 recommended
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_CATEGORIES.map((cat) => (
              <button
                key={cat.category}
                onClick={() =>
                  setActiveCategory(activeCategory === cat.category ? null : cat.category)
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  activeCategory === cat.category
                    ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-purple-200 border border-white/10'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {activeCategory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-white/5 mt-2"
            >
              {PRESET_CATEGORIES.find((c) => c.category === activeCategory)?.questions.map(
                (presetText, idx) => {
                  const isAdded = questions.some(
                    (q) => q.text.toLowerCase().trim() === presetText.toLowerCase().trim()
                  );
                  return (
                    <button
                      key={idx}
                      onClick={() => handleAddPreset(presetText)}
                      disabled={isAdded}
                      className={`text-left p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border transition-all ${
                        isAdded
                          ? 'bg-purple-950/40 border-purple-800/40 text-purple-300/60 opacity-60 cursor-default'
                          : 'bg-slate-950/60 hover:bg-purple-900/30 border-white/10 hover:border-pink-500/30 text-purple-100 cursor-pointer'
                      }`}
                    >
                      <span className="truncate">{presetText}</span>
                      {isAdded ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                      )}
                    </button>
                  );
                }
              )}
            </motion.div>
          )}
        </div>

        {/* Questions Header & Counter */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white">
              Questions ({questions.length})
            </h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                questions.length >= 10 && questions.length <= 15
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-purple-500/20 text-purple-300'
              }`}
            >
              {questions.length >= 10 && questions.length <= 15
                ? 'Ideal length ✨'
                : '10–15 recommended'}
            </span>
          </div>

          <button
            id="btn-add-question-top"
            onClick={handleAddBlankQuestion}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-200 hover:text-white text-xs font-semibold transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Question</span>
          </button>
        </div>

        {/* Questions List */}
        <div className="space-y-3.5">
          {questions.map((q, index) => (
            <motion.div
              key={q.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-white/10 hover:border-purple-500/30 transition-all group"
            >
              <div className="flex items-start gap-3">
                {/* Position Index */}
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 text-pink-300 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-1">
                  {String(index + 1).padStart(2, '0')}
                </div>

                {/* Input and Controls Area */}
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <input
                      id={`input-question-${index + 1}`}
                      type="text"
                      value={q.text}
                      onChange={(e) => handleUpdateText(q.id, e.target.value)}
                      placeholder="e.g. What’s your favourite memory with me? 🥺"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 focus:border-pink-500 focus:ring-1 focus:ring-pink-500/30 text-sm text-white placeholder-slate-500 outline-none transition-all"
                    />
                  </div>

                  {/* Bottom Toolbar: Quick Emojis + Reordering + Duplicate + Delete */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2 border-t border-white/5">
                    {/* Quick Emojis */}
                    <div className="flex items-center gap-1 overflow-x-auto max-w-[240px] sm:max-w-xs py-0.5">
                      <span className="text-[10px] text-purple-300/50 uppercase font-medium mr-1 flex items-center gap-0.5">
                        <Smile className="w-2.5 h-2.5" />
                      </span>
                      {COMMON_EMOJIS.slice(0, 8).map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleAddEmojiToQuestion(q.id, emoji)}
                          className="hover:scale-125 transition-transform text-xs p-1 rounded hover:bg-white/10 cursor-pointer"
                          title={`Add ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Move Up */}
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Move Up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === questions.length - 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Move Down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>

                      {/* Duplicate */}
                      <button
                        type="button"
                        onClick={() => handleDuplicate(index)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-white/10 transition-colors cursor-pointer"
                        title="Duplicate Question"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDelete(q.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete Question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Add Question Button */}
        <button
          id="btn-add-question-bottom"
          type="button"
          onClick={handleAddBlankQuestion}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-white/15 hover:border-pink-500/40 bg-slate-900/40 hover:bg-slate-900/60 text-purple-200 hover:text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 text-pink-400" />
          <span>Add Another Question</span>
        </button>

        {/* Error Warning Notice */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs sm:text-sm font-medium shadow-lg"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="break-words">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => handlePublish()}
              disabled={isPublishing}
              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-xs font-semibold shrink-0 cursor-pointer transition-all"
            >
              Retry
            </button>
          </motion.div>
        )}

        {/* Bottom Fixed-style Action Bar */}
        <div className="sticky bottom-4 z-20 p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-950/90 backdrop-blur-2xl border border-white/10 shadow-2xl flex items-center justify-between gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer shrink-0"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Preview Button */}
            <button
              id="btn-creator-preview"
              type="button"
              onClick={() => {
                if (validateQuiz()) {
                  setShowPreviewModal(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-purple-200 hover:text-white text-xs sm:text-sm font-semibold border border-white/10 transition-all cursor-pointer shrink-0"
            >
              <Eye className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">Preview 👀</span>
              <span className="sm:hidden">Preview</span>
            </button>

            {/* Publish Quiz Button */}
            <button
              id="btn-creator-publish"
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
              className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-xl shadow-pink-500/30 hover:shadow-pink-500/50 transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isPublishing ? (
                <>
                  <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Publish Quiz</span>
                  <span className="sm:hidden">Publish</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && (
        <PreviewQuizModal
          title={title}
          questions={questions}
          onClose={() => setShowPreviewModal(false)}
          onConfirmPublish={() => {
            setShowPreviewModal(false);
            handlePublish();
          }}
          isPublishing={isPublishing}
        />
      )}
    </div>
  );
};
