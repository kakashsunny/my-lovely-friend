import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Database, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { DatabaseStatusInfo } from '../types.ts';
import { safeFetchJson } from '../utils/api.ts';

interface DatabaseStatusModalProps {
  onClose: () => void;
  onRefreshStats: () => void;
}

export const DatabaseStatusModal: React.FC<DatabaseStatusModalProps> = ({
  onClose,
  onRefreshStats,
}) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<DatabaseStatusInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const { ok, data, error: fetchErr } = await safeFetchJson<DatabaseStatusInfo & { success: boolean; error?: string }>('/api/db-status');
      if (ok && data && data.success) {
        setStatus(data);
      } else {
        setError(fetchErr || data?.error || 'Failed to fetch database status');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error fetching status');
    } finally {
      setLoading(false);
    }
  };

  const retryConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const { ok, data, error: retryErr } = await safeFetchJson<{ success: boolean; status?: DatabaseStatusInfo; error?: string }>('/api/db/retry', { method: 'POST' });
      if (ok && data && data.status) {
        setStatus(data.status);
        onRefreshStats();
      } else {
        setError(retryErr || data?.error || 'Reconnection attempt failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to trigger reconnect');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-md rounded-3xl bg-slate-900/95 backdrop-blur-2xl border border-white/10 shadow-2xl p-6 text-white"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-400" />
            <h2 className="font-display text-lg font-bold text-white">Database Engine Status</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {status && (
          <div className="space-y-4">
            {/* Status Indicator Card */}
            <div
              className={`p-4 rounded-2xl border ${
                status.isConnectedToMongo
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : status.isMongoConfigured
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-purple-500/10 border-purple-500/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {status.isConnectedToMongo ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-semibold text-sm text-white">
                    {status.isConnectedToMongo
                      ? 'Connected to MongoDB Atlas'
                      : 'Built-in Document Storage (Active)'}
                  </h3>
                  <p className="text-xs text-slate-300/80 mt-1 leading-relaxed">
                    {status.message}
                  </p>
                </div>
              </div>
            </div>

            {/* If Mongo URI is configured but rejected by Atlas Network Access */}
            {status.isMongoConfigured && !status.isConnectedToMongo && (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-amber-500/20 text-xs space-y-2.5">
                <p className="font-semibold text-amber-300">
                  👉 To connect your MongoDB Atlas cluster:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed pl-1">
                  <li>
                    Open <span className="text-white font-medium">MongoDB Atlas</span> (
                    <a
                      href="https://cloud.mongodb.com"
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-purple-300 hover:text-purple-200 inline-flex items-center gap-0.5"
                    >
                      cloud.mongodb.com
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    )
                  </li>
                  <li>In left sidebar under Security, click <span className="text-white font-medium">"Network Access"</span></li>
                  <li>Click <span className="text-white font-medium">"+ Add IP Address"</span></li>
                  <li>Click <span className="text-white font-medium">"Allow Access from Anywhere"</span> (adds <code className="bg-white/10 px-1 rounded text-[11px]">0.0.0.0/0</code>)</li>
                  <li>Click <span className="text-white font-medium">"Confirm"</span></li>
                </ol>
                <p className="text-[11px] text-purple-200/60 pt-1 border-t border-white/5">
                  🛡️ Don't worry: Bestie has automatically saved all quizzes locally so you can test and use the app immediately!
                </p>
              </div>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-lg font-bold text-white">{status.totalQuizzes}</div>
                <div className="text-[10px] text-purple-300/70 uppercase tracking-wider">Total Quizzes</div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-lg font-bold text-white">{status.totalResponses}</div>
                <div className="text-[10px] text-purple-300/70 uppercase tracking-wider">Total Answers</div>
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                {error}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              {status.isMongoConfigured && !status.isConnectedToMongo && (
                <button
                  onClick={retryConnection}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-950/40 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Test Connection</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs cursor-pointer ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
