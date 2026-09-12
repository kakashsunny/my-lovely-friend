import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ActiveView, PlatformStats, SavedCreatorQuiz } from './types.ts';
import { DreamyBackground } from './components/DreamyBackground.tsx';
import { Navbar } from './components/Navbar.tsx';
import { FloatingNotifications } from './components/FloatingNotifications.tsx';
import { LandingView } from './components/LandingView.tsx';
import { CreateQuizView } from './components/CreateQuizView.tsx';
import { PublishSuccessView } from './components/PublishSuccessView.tsx';
import { ResponderQuizView } from './components/ResponderQuizView.tsx';
import { ManagementView } from './components/ManagementView.tsx';
import { AnswerCodeModal } from './components/AnswerCodeModal.tsx';
import { MyQuizzesDrawer } from './components/MyQuizzesDrawer.tsx';
import { DatabaseStatusModal } from './components/DatabaseStatusModal.tsx';
import { getSavedCreatorQuizzes, saveCreatorQuiz } from './utils/storage.ts';

export default function App() {
  // Parse URL on initial mount
  const parseUrl = (): ActiveView => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    // Check shareCode in path /q/:code or param ?q=
    if (path.startsWith('/q/')) {
      const code = path.replace('/q/', '').trim();
      if (code) return { type: 'answer', shareCode: code };
    }
    if (params.get('q')) {
      return { type: 'answer', shareCode: params.get('q')!.trim() };
    }

    // Check management token in path /manage/:token or param ?manage=
    if (path.startsWith('/manage/')) {
      const token = path.replace('/manage/', '').trim();
      if (token) return { type: 'manage', token };
    }
    if (params.get('manage')) {
      return { type: 'manage', token: params.get('manage')!.trim() };
    }

    if (path === '/create' || params.get('create') === 'true') {
      return { type: 'create' };
    }

    return { type: 'landing' };
  };

  const [activeView, setActiveView] = useState<ActiveView>(parseUrl);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [savedQuizzes, setSavedQuizzes] = useState<SavedCreatorQuiz[]>(getSavedCreatorQuizzes);

  // Modals
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [showMyQuizzesDrawer, setShowMyQuizzesDrawer] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);
  const [dismissedDbNotice, setDismissedDbNotice] = useState(false);

  // Fetch real statistics from database
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data && data.success) {
        setStats({
          totalQuizzes: data.totalQuizzes,
          totalResponses: data.totalResponses,
          dbProvider: data.dbProvider,
          isConnectedToMongo: data.isConnectedToMongo,
          isMongoConfigured: data.isMongoConfigured,
        });
      }
    } catch (err) {
      console.warn('Could not load stats', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Sync browser URL and popstate
  const navigateTo = (view: ActiveView, updateHistory = true) => {
    setActiveView(view);
    if (!updateHistory) return;

    let targetUrl = '/';
    if (view.type === 'answer') {
      targetUrl = `/q/${view.shareCode}`;
    } else if (view.type === 'manage') {
      targetUrl = `/manage/${view.token}`;
    } else if (view.type === 'create') {
      targetUrl = '/create';
    }

    try {
      window.history.pushState({}, '', targetUrl);
    } catch (err) {
      console.warn('History pushState error', err);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(parseUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle Publish Success
  const handlePublishSuccess = (data: {
    shareCode: string;
    managementToken: string;
    title: string;
    questionsCount: number;
  }) => {
    // Save to local device storage as backup convenience
    const newRecord: SavedCreatorQuiz = {
      id: `q_${data.shareCode}`,
      title: data.title,
      shareCode: data.shareCode,
      managementToken: data.managementToken,
      createdAt: new Date().toISOString(),
      questionsCount: data.questionsCount,
    };
    saveCreatorQuiz(newRecord);
    setSavedQuizzes(getSavedCreatorQuizzes());
    fetchStats();

    navigateTo({
      type: 'publish',
      shareCode: data.shareCode,
      managementToken: data.managementToken,
      title: data.title,
      questionsCount: data.questionsCount,
    });
  };

  return (
    <div className="relative min-h-screen bg-[#070913] text-slate-100 flex flex-col selection:bg-pink-500/30 selection:text-pink-200 overflow-x-hidden">
      {/* Dreamy Scene Background Artwork */}
      <DreamyBackground />

      {/* Floating Header Navigation */}
      <Navbar
        activeView={activeView}
        savedQuizzesCount={savedQuizzes.length}
        onNavigateHome={() => navigateTo({ type: 'landing' })}
        onNavigateCreate={() => navigateTo({ type: 'create' })}
        onOpenAnswerModal={() => setShowAnswerModal(true)}
        onOpenMyQuizzes={() => setShowMyQuizzesDrawer(true)}
      />

      {/* Atlas Network Access Notification Banner (when MONGODB_URI is provided but Atlas IP Access is pending) */}
      {stats?.isMongoConfigured && !stats?.isConnectedToMongo && !dismissedDbNotice && (
        <div className="relative z-30 max-w-5xl mx-auto w-full px-3 sm:px-6 lg:px-8 mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:px-4 sm:py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs backdrop-blur-md shadow-lg shadow-amber-950/20">
            <div className="flex items-start sm:items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 mt-1 sm:mt-0" />
              <p className="leading-relaxed">
                <strong className="font-semibold text-white">MongoDB Atlas:</strong> Enable Access from Anywhere (<code className="text-[11px] bg-amber-950/60 px-1.5 py-0.5 rounded text-amber-300 font-mono">0.0.0.0/0</code>) in Atlas Network Access. Bestie is currently saving safely to built-in persistent storage.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t border-amber-500/10 sm:border-t-0">
              <button
                onClick={() => setShowDbModal(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-white font-medium text-xs border border-amber-500/30 transition-colors cursor-pointer"
              >
                Guide & Test
              </button>
              <button
                onClick={() => setDismissedDbNotice(true)}
                className="text-amber-300/70 hover:text-white transition-colors cursor-pointer p-1"
                title="Dismiss"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {activeView.type === 'landing' && (
            <motion.div
              key="view-landing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <LandingView
                stats={stats}
                savedQuizzes={savedQuizzes}
                onCreateQuiz={() => navigateTo({ type: 'create' })}
                onAnswerQuiz={() => setShowAnswerModal(true)}
                onOpenManageQuiz={(token) => navigateTo({ type: 'manage', token })}
              />
            </motion.div>
          )}

          {activeView.type === 'create' && (
            <motion.div
              key="view-create"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <CreateQuizView
                onPublishSuccess={handlePublishSuccess}
                onCancel={() => navigateTo({ type: 'landing' })}
              />
            </motion.div>
          )}

          {activeView.type === 'publish' && (
            <motion.div
              key="view-publish"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <PublishSuccessView
                shareCode={activeView.shareCode}
                managementToken={activeView.managementToken}
                title={activeView.title}
                questionsCount={activeView.questionsCount}
                onGoToManage={(token) => navigateTo({ type: 'manage', token })}
                onCreateAnother={() => navigateTo({ type: 'create' })}
              />
            </motion.div>
          )}

          {activeView.type === 'answer' && (
            <motion.div
              key={`view-answer-${activeView.shareCode}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <ResponderQuizView
                shareCode={activeView.shareCode}
                onCreateMyQuiz={() => navigateTo({ type: 'create' })}
                onGoHome={() => navigateTo({ type: 'landing' })}
              />
            </motion.div>
          )}

          {activeView.type === 'manage' && (
            <motion.div
              key={`view-manage-${activeView.token}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <ManagementView
                managementToken={activeView.token}
                onGoHome={() => navigateTo({ type: 'landing' })}
                onCreateNewQuiz={() => navigateTo({ type: 'create' })}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Social Proof Notifications */}
      <FloatingNotifications />

      {/* Answer Modal */}
      {showAnswerModal && (
        <AnswerCodeModal
          onClose={() => setShowAnswerModal(false)}
          onSubmitCode={(code) => {
            setShowAnswerModal(false);
            navigateTo({ type: 'answer', shareCode: code });
          }}
        />
      )}

      {/* My Quizzes Drawer */}
      {showMyQuizzesDrawer && (
        <MyQuizzesDrawer
          savedQuizzes={savedQuizzes}
          onClose={() => setShowMyQuizzesDrawer(false)}
          onOpenManage={(token) => {
            setShowMyQuizzesDrawer(false);
            navigateTo({ type: 'manage', token });
          }}
          onCreateNew={() => {
            setShowMyQuizzesDrawer(false);
            navigateTo({ type: 'create' });
          }}
          onRefreshQuizzes={() => setSavedQuizzes(getSavedCreatorQuizzes())}
        />
      )}

      {/* Database Diagnostic & Status Modal */}
      {showDbModal && (
        <DatabaseStatusModal
          onClose={() => setShowDbModal(false)}
          onRefreshStats={fetchStats}
        />
      )}

      {/* Minimal Footer */}
      <footer className="relative z-10 w-full py-6 text-center text-xs text-purple-300/50 border-t border-white/5 flex flex-col items-center gap-2">
        <p className="flex items-center justify-center gap-1.5 font-medium">
          <span>Made for besties, late-night secrets & memories</span>
          <span>🌙</span>
        </p>
        <button
          onClick={() => setShowDbModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          {stats?.isConnectedToMongo ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>MongoDB Atlas Connected</span>
            </>
          ) : stats?.isMongoConfigured ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Built-in Storage (Atlas Network Setup)</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span>Built-in Persistent Database</span>
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
