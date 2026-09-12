import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Sparkles, Eye, X } from 'lucide-react';

interface NotificationItem {
  id: string;
  text: string;
  avatar: string;
  time: string;
  type: 'answer' | 'create';
}

const SAMPLE_NOTIFS: NotificationItem[] = [
  {
    id: '1',
    text: 'Sarah just answered your quiz 💌',
    avatar: '🌸',
    time: '2m ago',
    type: 'answer',
  },
  {
    id: '2',
    text: 'Rahul completed your quiz 👀',
    avatar: '⚡',
    time: '4m ago',
    type: 'answer',
  },
  {
    id: '3',
    text: 'Priya created a new quiz ✨',
    avatar: '🦋',
    time: '7m ago',
    type: 'create',
  },
  {
    id: '4',
    text: 'Aarav answered 12 questions ❤️',
    avatar: '🪐',
    time: '11m ago',
    type: 'answer',
  },
  {
    id: '5',
    text: 'Maya shared her quiz link 🚀',
    avatar: '🌙',
    time: '15m ago',
    type: 'create',
  },
];

export const FloatingNotifications: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;

    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % SAMPLE_NOTIFS.length);
        setIsVisible(true);
      }, 500);
    }, 6000);

    return () => clearInterval(interval);
  }, [dismissed]);

  if (dismissed) return null;

  const notif = SAMPLE_NOTIFS[currentIndex];

  return (
    <div className="fixed bottom-4 left-4 z-30 pointer-events-none select-none max-w-[320px] hidden sm:block">
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="pointer-events-auto flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-pink-500/20 shadow-xl shadow-purple-950/40"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/30 flex items-center justify-center text-sm shrink-0">
              {notif.avatar}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <p className="text-xs font-medium text-slate-100 truncate">
                {notif.text}
              </p>
              <p className="text-[10px] text-purple-300/60 font-medium">
                {notif.time} • Live activity
              </p>
            </div>

            <button
              onClick={() => setDismissed(true)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-full hover:bg-white/5 transition-colors"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
