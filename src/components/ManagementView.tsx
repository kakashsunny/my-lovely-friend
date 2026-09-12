import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  Copy,
  Check,
  Trash2,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Clock,
  Heart,
  AlertTriangle,
  ArrowLeft,
  Share2,
} from 'lucide-react';
import { QuizManagementData, QuizResponse } from '../types.ts';
import { timeAgo, removeSavedCreatorQuiz } from '../utils/storage.ts';
import { ResponseDetailModal } from './ResponseDetailModal.tsx';
import { safeFetchJson } from '../utils/api.ts';

interface ManagementViewProps {
  managementToken: string;
  onGoHome: () => void;
  onCreateNewQuiz: () => void;
}

export const ManagementView: React.FC<ManagementViewProps> = ({
  managementToken,
  onGoHome,
  onCreateNewQuiz,
}) => {
  const [quiz, setQuiz] = useState<QuizManagementData | null>(null);
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedResponse, setSelectedResponse] = useState<QuizResponse | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDeletingQuiz, setIsDeletingQuiz] = useState(false);
  const [showDeleteQuizConfirm, setShowDeleteQuizConfirm] = useState(false);

  // Fetch management data
  const loadData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    try {
      const { ok, data, error } = await safeFetchJson<{
        success: boolean;
        quiz: QuizManagementData;
        responses: QuizResponse[];
        error?: string;
      }>(`/api/quizzes/manage/${encodeURIComponent(managementToken)}`);

      if (!ok || !data?.success) {
        throw new Error(error || data?.error || 'Failed to load quiz responses');
      }

      setQuiz(data.quiz);
      setResponses(data.responses || []);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Unable to access responses with this management link.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [managementToken]);

  const publicUrl = quiz ? `${window.location.origin}/q/${quiz.shareCode}` : '';

  const handleCopyPublicLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.warn(err);
    }
  };

  const handleDeleteResponse = async (responseId: string) => {
    try {
      const { ok, data, error } = await safeFetchJson<{ success: boolean; error?: string }>(
        `/api/quizzes/manage/${encodeURIComponent(managementToken)}/responses/${encodeURIComponent(
          responseId
        )}`,
        { method: 'DELETE' }
      );
      if (!ok || !data?.success) {
        throw new Error(error || data?.error || 'Failed to delete response');
      }
      setResponses((prev) => prev.filter((r) => r._id !== responseId));
    } catch (err: any) {
      setErrorMessage(err.message || 'Error deleting response');
    }
  };

  const handleDeleteQuiz = async () => {
    setIsDeletingQuiz(true);
    try {
      const { ok, data, error } = await safeFetchJson<{ success: boolean; error?: string }>(
        `/api/quizzes/manage/${encodeURIComponent(managementToken)}`,
        { method: 'DELETE' }
      );
      if (!ok || !data?.success) {
        throw new Error(error || data?.error || 'Failed to delete quiz');
      }
      removeSavedCreatorQuiz(managementToken);
      onGoHome();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error deleting quiz');
      setIsDeletingQuiz(false);
    }
  };

  if (isLoading) {
    return (
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[60vh] px-4 text-white">
        <div className="w-12 h-12 rounded-full border-3 border-purple-500/20 border-t-purple-500 animate-spin mb-4" />
        <p className="text-sm font-medium text-purple-200/80">
          Decrypting your private responses...
        </p>
      </div>
    );
  }

  if (errorMessage || !quiz) {
    return (
      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-16 text-center text-white">
        <div className="p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-rose-500/30 shadow-2xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-2xl">
            🔒
          </div>
          <h2 className="font-display text-2xl font-bold text-white">Access Denied</h2>
          <p className="text-xs sm:text-sm text-purple-200/70">
            {errorMessage || 'This private management link is invalid or the quiz was deleted.'}
          </p>
          <div className="pt-2">
            <button
              onClick={onGoHome}
              className="px-6 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 w-full max-w-3xl mx-auto px-4 py-8 sm:py-12 text-white">
      {/* Top Breadcrumb / Action */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onGoHome}
          className="flex items-center gap-1.5 text-xs text-purple-300 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <button
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-purple-200 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Hero Management Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-pink-300 text-xs font-semibold mb-3">
          <Lock className="w-3.5 h-3.5" />
          <span>Private Creator Dashboard</span>
        </div>

        <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Who really knows you? 👀
        </h1>

        <p className="text-base sm:text-lg text-pink-200 font-semibold mt-2">
          {responses.length} {responses.length === 1 ? 'Response' : 'Responses'}
        </p>
        <p className="text-xs text-purple-300/70 mt-0.5">
          Quiz: “{quiz.title}” • Created {timeAgo(quiz.createdAt)}
        </p>
      </div>

      {/* Share Links Quick Box */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-purple-500/20 shadow-xl mb-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="min-w-0 flex-1 text-left w-full sm:w-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-pink-300">
            Share Link for Friends
          </span>
          <p className="font-mono text-xs text-purple-200 truncate mt-0.5 select-all">
            {publicUrl}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={handleCopyPublicLink}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied! 💌</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/10 transition-colors"
            title="Open public quiz in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Responses List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>Friends' Answers</span>
            <span className="px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-xs font-mono font-bold">
              {responses.length}
            </span>
          </h2>
          <span className="text-xs text-purple-300/60">Click any card to read full answers</span>
        </div>

        {responses.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/10 text-center space-y-4">
            <div className="text-4xl">⏳</div>
            <h3 className="font-display text-xl font-bold text-white">
              No responses yet!
            </h3>
            <p className="text-xs sm:text-sm text-purple-200/70 max-w-sm mx-auto">
              Send your quiz link to your friends on WhatsApp, Instagram, or Discord to see their answers appear here.
            </p>
            <div className="pt-2">
              <button
                onClick={handleCopyPublicLink}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-pink-500/25 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Quiz Link to Send</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {responses.map((resp) => {
              // Sample preview text from first answer
              const firstAns = resp.answers[0]?.answerText;
              return (
                <motion.div
                  key={resp._id}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedResponse(resp)}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-900/75 hover:bg-slate-900 backdrop-blur-xl border border-white/10 hover:border-pink-500/40 shadow-lg cursor-pointer transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center text-lg shrink-0">
                      💌
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-pink-300 transition-colors truncate">
                          {resp.responderName}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                          {resp.answers.length} answers
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-purple-300/70 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Answered {timeAgo(resp.submittedAt)}</span>
                        {firstAns && (
                          <span className="hidden sm:inline text-slate-400 truncate max-w-xs italic">
                            • "{firstAns}"
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden xs:inline text-xs font-semibold text-purple-300/80 group-hover:text-pink-300 transition-colors">
                      Read 💌
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-pink-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Danger Zone: Delete Quiz */}
      <div className="mt-12 p-5 rounded-3xl bg-rose-950/20 border border-rose-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-left w-full sm:w-auto">
          <h3 className="text-sm font-bold text-rose-300">Danger Zone</h3>
          <p className="text-xs text-rose-200/60">
            Permanently delete this quiz and all {responses.length} responses.
          </p>
        </div>

        {!showDeleteQuizConfirm ? (
          <button
            onClick={() => setShowDeleteQuizConfirm(true)}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Quiz</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowDeleteQuizConfirm(false)}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteQuiz}
              disabled={isDeletingQuiz}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg transition-all cursor-pointer"
            >
              {isDeletingQuiz ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        )}
      </div>

      {/* Response Detail Modal */}
      {selectedResponse && (
        <ResponseDetailModal
          response={selectedResponse}
          questions={quiz.questions}
          onClose={() => setSelectedResponse(null)}
          onDeleteResponse={handleDeleteResponse}
        />
      )}
    </div>
  );
};
