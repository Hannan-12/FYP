import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Clock, Code as CodeIcon, Keyboard, Brain, User, Calendar, ShieldCheck, ShieldAlert, Eye } from "lucide-react";
import { motion } from "framer-motion";

const DetailCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-slate-800/40 border border-slate-700 p-5 rounded-2xl flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
      <Icon size={20} className={color.replace('bg-', 'text-')} />
    </div>
    <div>
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  </div>
);

const SessionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const docSnap = await getDoc(doc(db, "sessions", id));
      if (docSnap.exists()) setSession({ id: docSnap.id, ...docSnap.data() });
      setLoading(false);
    };
    fetchSession();
  }, [id]);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading details...</div>;
  if (!session) return <div className="p-10 text-center text-slate-500">Session not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
           <h1 className="text-2xl font-bold text-white flex items-center gap-3">
             Session Analysis
             <span className="text-sm font-normal text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">ID: {session.id}</span>
           </h1>
           <p className="text-slate-400 flex items-center gap-2 mt-1">
             <User size={14} /> {session.email} • <Calendar size={14} /> {new Date(session.timestamp.seconds * 1000).toLocaleString()}
           </p>
        </div>
      </div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <DetailCard label="Time Taken" value={`${session.stats?.duration || 0}s`} icon={Clock} color="bg-orange-500" />
        <DetailCard label="Keystrokes" value={session.stats?.keystrokes || 0} icon={Keyboard} color="bg-blue-500" />
        <DetailCard
          label="AI Probability"
          value={`${(session.stats?.aiProbability || 0).toFixed(1)}%`}
          icon={Brain}
          color={(session.stats?.aiProbability || 0) > 50 ? "bg-red-500" : "bg-emerald-500"}
        />
      </motion.div>

      {/* AI Detection Signal Breakdown */}
      {session.aiDetection?.signals && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              {(session.aiDetection.aiLikelihoodScore || 0) > 50 ? (
                <ShieldAlert className="text-red-400" size={24} />
              ) : (
                <ShieldCheck className="text-green-400" size={24} />
              )}
              <div>
                <h2 className="text-lg font-bold text-white">AI Detection Analysis</h2>
                <p className="text-xs text-slate-500">
                  Physics-based behavioral analysis — {session.aiDetection.confidence}% confidence
                </p>
              </div>
            </div>
            <div className={`text-2xl font-bold px-4 py-2 rounded-xl ${
              (session.aiDetection.aiLikelihoodScore || 0) > 70 ? 'bg-red-500/20 text-red-400' :
              (session.aiDetection.aiLikelihoodScore || 0) > 40 ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              {(session.aiDetection.aiLikelihoodScore || 0).toFixed(0)}%
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(session.aiDetection.signals).map(([key, signal]) => (
              <div key={key} className="bg-slate-900/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">{signal.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      signal.verdict === "ai_likely" ? "bg-red-500/20 text-red-400" :
                      signal.verdict === "suspicious" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-green-500/20 text-green-400"
                    }`}>
                      {signal.verdict === "ai_likely" ? "AI LIKELY" :
                       signal.verdict === "suspicious" ? "SUSPICIOUS" : "HUMAN"}
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${
                    signal.verdict === "ai_likely" ? "text-red-400" :
                    signal.verdict === "suspicious" ? "text-yellow-400" : "text-green-400"
                  }`}>
                    {signal.score}/100
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      signal.verdict === "ai_likely" ? "bg-red-500" :
                      signal.verdict === "suspicious" ? "bg-yellow-500" : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(signal.score, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">{signal.description}</p>
              </div>
            ))}
          </div>

          {session.aiDetection.recommendation && (
            <div className="mt-5 pt-4 border-t border-slate-700/50 flex items-start gap-2">
              <Eye className="text-slate-400 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-sm text-slate-400">{session.aiDetection.recommendation}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Code Viewer */}
      {session.code && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#0f1117] rounded-2xl shadow-2xl border border-slate-800 overflow-hidden"
        >
          <div className="bg-slate-900/80 px-4 py-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-400">
              <CodeIcon size={16} />
              <span className="text-sm font-mono">{session.fileName || "script.py"}</span>
            </div>
            <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">{session.language}</span>
          </div>
          <div className="p-6 overflow-x-auto">
            <pre className="font-mono text-sm text-emerald-300 leading-relaxed">
              <code>{session.code}</code>
            </pre>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SessionDetail;