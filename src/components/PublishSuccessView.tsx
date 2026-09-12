import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Check,
  Copy,
  Share2,
  Lock,
  ArrowRight,
  ExternalLink,
  QrCode,
  Sparkles,
  AlertTriangle,
  MessageCircle,
} from 'lucide-react';

interface PublishSuccessViewProps {
  shareCode: string;
  managementToken: string;
  title: string;
  questionsCount: number;
  onGoToManage: (token: string) => void;
  onCreateAnother: () => void;
}

export const PublishSuccessView: React.FC<PublishSuccessViewProps> = ({
  shareCode,
  managementToken,
  title,
  questionsCount,
  onGoToManage,
  onCreateAnother,
}) => {
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedPrivate, setCopiedPrivate] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Derive origin
  const origin = window.location.origin;
  const publicQuizUrl = `${origin}/q/${shareCode}`;
  const privateManageUrl = `${origin}/manage/${managementToken}`;

  // Confetti burst on mount
  useEffect(() => {
    const end = Date.now() + 1500;
    const colors = ['#ec4899', '#a855f7', '#6366f1', '#f472b6', '#38bdf8'];

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  const handleCopyPublic = async () => {
    try {
      await navigator.clipboard.writeText(publicQuizUrl);
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyPrivate = async () => {
    try {
      await navigator.clipboard.writeText(privateManageUrl);
      setCopiedPrivate(true);
      setTimeout(() => setCopiedPrivate(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(
      `Hey! I made a personal friendship quiz "${title}". Let's see how well you really know me! 👀 Answer here:\n${publicQuizUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bestie Quiz: ${title}`,
          text: `How well do you really know me? Answer my friendship quiz! 👀`,
          url: publicQuizUrl,
        });
      } catch (err) {
        console.warn(err);
      }
    } else {
      handleCopyPublic();
    }
  };

  return (
    <div className="relative z-10 w-full max-w-2xl mx-auto px-4 py-8 sm:py-12 text-white">
      {/* Celebration Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200 }}
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 p-[2px] mx-auto mb-4 shadow-2xl shadow-pink-500/30"
        >
          <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center text-3xl sm:text-4xl">
            ✨
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight"
        >
          ✨ Your quiz is ready!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-base sm:text-lg text-purple-200/90 font-medium mt-2"
        >
          Now let's see who really knows you. 👀
        </motion.p>
      </div>

      <div className="space-y-6">
        {/* PUBLIC SHARE CARD */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 sm:p-7 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-pink-500/30 shadow-2xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-pink-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-pink-400" />
              Public Quiz Link (Send this to friends!)
            </span>
            <span className="text-xs font-mono text-purple-300/70 bg-purple-950/60 px-2 py-0.5 rounded-lg border border-purple-800/40">
              Code: {shareCode}
            </span>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950/90 border border-white/10 font-mono text-xs sm:text-sm text-pink-200 mb-4 overflow-x-auto">
            <span className="select-all truncate">{publicQuizUrl}</span>
          </div>

          {/* Sharing Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Copy Link */}
            <button
              id="btn-copy-public-link"
              onClick={handleCopyPublic}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-semibold text-xs sm:text-sm shadow-md shadow-pink-500/25 transition-all cursor-pointer"
            >
              {copiedPublic ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Copied! 💌</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            {/* Share on WhatsApp */}
            <button
              id="btn-share-whatsapp"
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            {/* Native Share */}
            <button
              id="btn-share-native"
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs sm:text-sm border border-white/10 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-purple-300" />
              <span>Share</span>
            </button>
          </div>
        </motion.div>

        {/* PRIVATE CREATOR MANAGEMENT CARD */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 sm:p-7 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-purple-500/40 shadow-2xl relative overflow-hidden"
        >
          <div className="flex items-center gap-2 text-purple-300 mb-2">
            <Lock className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm sm:text-base font-bold text-white">
              🔐 Your private results link
            </h2>
          </div>

          <p className="text-xs text-purple-200/80 mb-3">
            Save this link. You need it to see your responses.
          </p>

          <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950/90 border border-purple-500/20 font-mono text-xs text-purple-200 mb-4 overflow-x-auto">
            <span className="select-all truncate">{privateManageUrl}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              id="btn-copy-private-link"
              onClick={handleCopyPrivate}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              {copiedPrivate ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Private Link Copied! 🔐</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Private Link</span>
                </>
              )}
            </button>

            <button
              id="btn-go-to-responses"
              onClick={() => onGoToManage(managementToken)}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
            >
              <span>View Responses 👀</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Privacy Architecture Notice */}
          <div className="mt-5 p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/40 flex items-start gap-2.5 text-xs text-purple-200/80">
            <AlertTriangle className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-white">Important Privacy Note:</strong> Anyone with your quiz
              link can answer. Only you with your private results link can see the responses.
            </p>
          </div>
        </motion.div>

        {/* Create Another Quiz CTA */}
        <div className="text-center pt-2">
          <button
            onClick={onCreateAnother}
            className="text-xs sm:text-sm text-purple-300/80 hover:text-white underline underline-offset-4 cursor-pointer transition-colors"
          >
            Want to create another quiz? ✨
          </button>
        </div>
      </div>
    </div>
  );
};
