import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Sparkles,
  Heart,
  AlertCircle,
  CheckCircle2,
  Lock,
  ChevronLeft,
  HelpCircle,
} from 'lucide-react';
import { QuizPublic } from '../types.ts';
import { validateAnswer, ValidationResult } from '../utils/answerValidator.ts';
import { safeFetchJson } from '../utils/api.ts';

interface ResponderQuizViewProps {
  shareCode: string;
  onCreateMyQuiz: () => void;
  onGoHome: () => void;
}

export const ResponderQuizView: React.FC<ResponderQuizViewProps> = ({
  shareCode,
  onCreateMyQuiz,
  onGoHome,
}) => {
  const [quiz, setQuiz] = useState<QuizPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Flow states: 'name' -> 'questions' -> 'review' -> 'sent'
  const [step, setStep] = useState<'name' | 'questions' | 'review' | 'sent'>('name');
  const [responderName, setResponderName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  // Question index (0..questions.length - 1)
  const [currentQIndex, setCurrentQIndex] = useState(0);
  // Answers map: questionId -> answerText
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch Quiz on mount
  useEffect(() => {
    let isMounted = true;

    async function loadQuiz() {
      setIsLoading(true);
      setFetchError(null);
      try {
        const { ok, data, error } = await safeFetchJson<{ success: boolean; quiz: QuizPublic; error?: string }>(
          `/api/quizzes/${encodeURIComponent(shareCode)}`
        );
        if (!ok || !data?.success || !data.quiz) {
          throw new Error(error || data?.error || 'Quiz not found');
        }
        if (isMounted) {
          setQuiz(data.quiz);
        }
      } catch (err: any) {
        if (isMounted) {
          setFetchError(err.message || 'Failed to load quiz');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadQuiz();

    return () => {
      isMounted = false;
    };
  }, [shareCode]);

  // Handle start quiz from name screen
  const handleStartQuiz = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!responderName.trim()) {
      setNameError('Please enter your name to continue! 💌');
      return;
    }
    setNameError(null);
    setStep('questions');
    setCurrentQIndex(0);
  };

  // State for tactile validation feedback & refs
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [showAttemptWarning, setShowAttemptWarning] = useState(false);

  const triggerShake = () => {
    setIsShaking(true);
    setShowAttemptWarning(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  // Current question helpers
  const currentQuestion = quiz?.questions[currentQIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] || '' : '';
  const totalQuestions = quiz?.questions.length || 0;

  // Real-time Context-Aware Smart Validation for current question
  const currentValidation: ValidationResult = useMemo(() => {
    if (!currentQuestion) return { isValid: false };
    return validateAnswer(currentQuestion.text, currentAnswer);
  }, [currentQuestion, currentAnswer]);

  const isAnswerValid = currentValidation.isValid;

  const handleSetCurrentAnswer = (text: string) => {
    if (!currentQuestion) return;
    setShowAttemptWarning(false);
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: text,
    }));
  };

  const handleNextQuestion = () => {
    if (!currentQuestion) return;
    if (!isAnswerValid) {
      triggerShake();
      textareaRef.current?.focus();
      return;
    }
    setShowAttemptWarning(false);
    if (currentQIndex < totalQuestions - 1) {
      setCurrentQIndex((prev) => prev + 1);
    } else {
      setStep('review');
    }
  };

  const handlePrevQuestion = () => {
    setShowAttemptWarning(false);
    if (currentQIndex > 0) {
      setCurrentQIndex((prev) => prev - 1);
    } else {
      setStep('name');
    }
  };

  // Submit all answers
  const handleSubmitAnswers = async () => {
    if (!quiz) return;
    setIsSubmitting(true);
    setSubmitError(null);

    // Frontend pre-flight validation
    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i];
      const a = answers[q.id] || '';
      const v = validateAnswer(q.text, a);
      if (!v.isValid) {
        setCurrentQIndex(i);
        setStep('questions');
        triggerShake();
        setSubmitError(`Question #${i + 1} needs a real answer bestie! 👀`);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const formattedAnswers = quiz.questions.map((q) => ({
        questionId: q.id,
        answerText: answers[q.id] || '',
      }));

      const { ok, data, error, questionId: errQId } = await safeFetchJson<{
        success: boolean;
        error?: string;
        questionId?: string;
        reason?: string;
      }>(`/api/quizzes/${encodeURIComponent(shareCode)}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responderName: responderName.trim(),
          answers: formattedAnswers,
        }),
      });

      if (!ok || !data?.success) {
        const targetQId = errQId || data?.questionId;
        if (targetQId) {
          const targetIndex = quiz.questions.findIndex((q) => q.id === targetQId);
          if (targetIndex !== -1) {
            setCurrentQIndex(targetIndex);
            setStep('questions');
            triggerShake();
          }
        }
        throw new Error(error || data?.error || 'Failed to submit responses. Please try again.');
      }

      setStep('sent');

      // Celebration Confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ec4899', '#a855f7', '#6366f1', '#f472b6', '#38bdf8'],
      });
    } catch (err: any) {
      console.error('Submit error:', err);
      setSubmitError(err.message || 'Could not submit your answers. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[60vh] px-4 text-white">
        <div className="w-12 h-12 rounded-full border-3 border-pink-500/20 border-t-pink-500 animate-spin mb-4" />
        <p className="text-sm font-medium text-purple-200/80">Loading your bestie's quiz...</p>
      </div>
    );
  }

  // Fetch Error State
  if (fetchError || !quiz) {
    return (
      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-16 text-center text-white">
        <div className="p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-rose-500/30 shadow-2xl space-y-4">
          <div className="text-4xl">🥺</div>
          <h2 className="font-display text-2xl font-bold text-white">Quiz Not Found</h2>
          <p className="text-sm text-purple-200/70">
            {fetchError || "This quiz link might have expired or doesn't exist."}
          </p>
          <div className="pt-2">
            <button
              onClick={onGoHome}
              className="px-6 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              Go to Home ✨
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 w-full max-w-xl mx-auto px-4 py-8 sm:py-12 text-white">
      {/* ─────────────────────────────────────────────────────────────
          SCREEN 1: NAME ENTRY
      ───────────────────────────────────────────────────────────── */}
      {step === 'name' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-pink-500/30 shadow-2xl text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 p-[2px] mx-auto shadow-xl shadow-pink-500/20">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-2xl">
              👀
            </div>
          </div>

          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Before we start… 👀
            </h1>
            <p className="text-sm sm:text-base text-purple-200/80 mt-1">
              What should we call you?
            </p>
          </div>

          <form onSubmit={handleStartQuiz} className="space-y-4">
            <div className="text-left">
              <input
                id="input-responder-name"
                type="text"
                autoFocus
                value={responderName}
                onChange={(e) => {
                  setResponderName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Enter your name"
                className="w-full px-5 py-4 rounded-2xl bg-slate-950/80 border border-purple-500/30 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30 text-center font-display text-lg sm:text-xl font-bold text-white placeholder-purple-300/40 outline-none transition-all"
              />
              {nameError && (
                <p className="text-xs text-rose-400 mt-2 text-center font-medium flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{nameError}</span>
                </p>
              )}
            </div>

            <div className="pt-2">
              <p className="text-xs text-purple-300/80 mb-3 font-medium">
                Ready? How well do you know them?
              </p>

              <button
                id="btn-start-quiz"
                type="submit"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white font-bold text-base shadow-xl shadow-pink-500/30 hover:shadow-pink-500/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Start Quiz</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Quiz metadata info */}
          <div className="pt-4 border-t border-white/5 text-[11px] text-purple-300/60 flex items-center justify-center gap-3">
            <span>Quiz: {quiz.title}</span>
            <span>•</span>
            <span>{totalQuestions} questions</span>
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCREEN 2: QUESTION BY QUESTION (ONE AT A TIME)
      ───────────────────────────────────────────────────────────── */}
      {step === 'questions' && currentQuestion && (
        <div className="space-y-6">
          {/* Progress bar and counter */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-white/10 shadow-lg">
            <div className="flex items-center justify-between text-xs sm:text-sm font-semibold text-purple-300 mb-2.5">
              <span className="font-mono text-pink-300">
                {String(currentQIndex + 1).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}
              </span>
              <span className="text-purple-200/70 truncate max-w-[200px]">
                {quiz.title}
              </span>
            </div>

            {/* Visual Progress Bar: 01 ━━━━━○━━━━━━━━ 15 */}
            <div className="relative w-full bg-slate-950/80 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/5">
              <motion.div
                className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-400 h-full rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${((currentQIndex + 1) / totalQuestions) * 100}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Question Box */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -25 }}
              transition={{ duration: 0.3 }}
              className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-pink-500/20 shadow-2xl space-y-6"
            >
              {/* Question Header & Order */}
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs font-bold font-mono">
                  Question {String(currentQIndex + 1).padStart(2, '0')}
                </span>
                <span className="text-xs text-purple-400/80 font-medium">
                  Free-text answer
                </span>
              </div>

              {/* Question Text */}
              <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-white leading-snug">
                {currentQuestion.text}
              </h2>

              {/* Large Text Input with Tactile Validation */}
              <div className="space-y-2.5">
                <motion.div
                  animate={isShaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
                  transition={{ duration: 0.4 }}
                >
                  <textarea
                    ref={textareaRef}
                    id={`input-answer-${currentQIndex + 1}`}
                    rows={3}
                    value={currentAnswer}
                    onChange={(e) => handleSetCurrentAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (isAnswerValid) {
                          handleNextQuestion();
                        } else {
                          triggerShake();
                        }
                      }
                    }}
                    placeholder="Type your answer…"
                    className={`w-full px-5 py-4 rounded-2xl bg-slate-950/90 border text-base sm:text-lg text-white placeholder-purple-300/40 outline-none transition-all resize-none shadow-inner ${
                      currentAnswer.trim().length > 0 && !isAnswerValid
                        ? 'border-pink-500/70 focus:border-pink-400 focus:ring-2 focus:ring-pink-500/30'
                        : isAnswerValid
                        ? 'border-emerald-500/50 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20'
                        : 'border-purple-500/30 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30'
                    }`}
                  />
                </motion.div>

                {/* Real-time Context-Aware Validation Status */}
                <div className="min-h-[26px]">
                  {currentAnswer.trim().length === 0 ? (
                    <div className="flex items-center justify-between text-xs px-1 text-purple-300/60 font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                        <span>👀 Type your real answer bestie...</span>
                      </span>
                      <span className="hidden sm:inline text-[11px] text-purple-400/50">
                        No skips allowed ✨
                      </span>
                    </div>
                  ) : !isAnswerValid ? (
                    <motion.div
                      key={currentValidation.message}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-pink-500/15 border border-pink-500/40 text-pink-200 text-xs font-semibold shadow-sm"
                    >
                      <AlertCircle className="w-4 h-4 text-pink-400 shrink-0" />
                      <span>{currentValidation.message || '👀 Give me a real answer bestie!'}</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between text-xs px-1"
                    >
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Ready to continue ✨</span>
                      </span>

                      <span className="hidden sm:inline text-purple-300/50">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px]">Enter ↵</kbd> to advance
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Navigation Buttons: ← Back and Next → (NO SKIP) */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  id="btn-question-back"
                  type="button"
                  onClick={handlePrevQuestion}
                  className="flex items-center justify-center gap-1.5 px-5 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-semibold transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>← Back</span>
                </button>

                <button
                  id="btn-question-next"
                  type="button"
                  onClick={handleNextQuestion}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm sm:text-base shadow-xl transition-all cursor-pointer ${
                    isAnswerValid
                      ? 'bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white shadow-pink-500/30 hover:shadow-pink-500/50 transform hover:-translate-y-0.5'
                      : 'bg-slate-800/60 text-purple-300/40 border border-white/5 cursor-pointer opacity-70 hover:border-pink-500/30'
                  }`}
                >
                  <span>
                    {currentQIndex === totalQuestions - 1 ? 'Review & Submit ✨' : 'Next →'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCREEN 3: REVIEW & FINAL SUBMIT
      ───────────────────────────────────────────────────────────── */}
      {step === 'review' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-pink-500/30 shadow-2xl space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="text-4xl">🎉</div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              You made it! 🎉
            </h2>
            <p className="text-sm text-purple-200/80">
              Ready to send your answers to your bestie?
            </p>
          </div>

          {/* Review Answers Summary with Validation Status */}
          <div className="max-h-[340px] overflow-y-auto space-y-2.5 pr-1">
            {quiz.questions.map((q, idx) => {
              const qVal = validateAnswer(q.text, answers[q.id] || '');
              return (
                <div
                  key={q.id}
                  className={`p-3.5 rounded-2xl border transition-all text-left flex items-start justify-between gap-3 ${
                    qVal.isValid
                      ? 'bg-slate-950/70 border-white/10'
                      : 'bg-rose-950/30 border-rose-500/50 ring-1 ring-rose-500/30'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs text-purple-300/80 font-medium">
                      {idx + 1}. {q.text}
                    </p>
                    <p className="text-sm font-semibold text-pink-200 break-words">
                      {answers[q.id] || '—'}
                    </p>
                    {!qVal.isValid && (
                      <p className="text-xs font-medium text-rose-300 flex items-center gap-1.5 pt-0.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>{qVal.message || 'Needs a real answer bestie!'}</span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setCurrentQIndex(idx);
                      setStep('questions');
                    }}
                    className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                      qVal.isValid
                        ? 'text-purple-300 hover:text-white hover:bg-white/10'
                        : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 shadow-sm'
                    }`}
                  >
                    {qVal.isValid ? 'Edit' : 'Fix Answer ✏️'}
                  </button>
                </div>
              );
            })}
          </div>

          {submitError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs text-center flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => {
                setCurrentQIndex(totalQuestions - 1);
                setStep('questions');
              }}
              className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-all cursor-pointer"
            >
              ← Back
            </button>

            {(() => {
              const allValid = quiz.questions.every(
                (q) => validateAnswer(q.text, answers[q.id] || '').isValid
              );
              return (
                <button
                  id="btn-submit-answers"
                  onClick={() => {
                    if (!allValid) {
                      const firstInvalid = quiz.questions.findIndex(
                        (q) => !validateAnswer(q.text, answers[q.id] || '').isValid
                      );
                      if (firstInvalid !== -1) {
                        setCurrentQIndex(firstInvalid);
                        setStep('questions');
                        triggerShake();
                      }
                      return;
                    }
                    handleSubmitAnswers();
                  }}
                  disabled={isSubmitting}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base shadow-xl transition-all cursor-pointer ${
                    allValid
                      ? 'bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white shadow-pink-500/30 hover:shadow-pink-500/50'
                      : 'bg-slate-800/80 text-rose-300/80 border border-rose-500/30 hover:border-rose-500/60'
                  } disabled:opacity-50`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending answers...</span>
                    </>
                  ) : !allValid ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>Fix Answers to Submit 👀</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>💌 Submit Answers</span>
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SCREEN 4: POST-SUBMISSION CELEBRATION
      ───────────────────────────────────────────────────────────── */}
      {step === 'sent' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 sm:p-10 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-pink-500/30 shadow-2xl text-center space-y-6"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 p-[2px] mx-auto shadow-2xl shadow-pink-500/30">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-4xl">
              💌
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
              Answers sent! 💜
            </h1>
            <p className="text-lg font-semibold text-pink-200">
              Thanks, {responderName}!
            </p>
            <p className="text-sm text-purple-200/80 max-w-sm mx-auto">
              Your answers are safely on their way to your friend.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-950/60 border border-purple-500/20 space-y-4">
            <p className="text-sm font-bold text-white">
              Want to see what your friends really think about you?
            </p>

            <button
              id="btn-create-my-own-quiz"
              onClick={onCreateMyQuiz}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white font-bold text-base shadow-xl shadow-pink-500/30 hover:shadow-pink-500/50 transform hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5 text-pink-200" />
              <span>✨ Create My Quiz</span>
            </button>

            <p className="text-[11px] text-purple-300/60">
              Takes 60 seconds • No account or signup required
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};
