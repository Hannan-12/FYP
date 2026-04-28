import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft, Clock, Code as CodeIcon, Keyboard, User, Calendar,
  Brain, Shield, FileCode, Layers, GitBranch, Clipboard, RotateCcw, Zap
} from "lucide-react";
import { motion } from "framer-motion";

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="bg-slate-800/40 border border-slate-700 p-5 rounded-2xl flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color} bg-opacity-10 shrink-0`}>
      <Icon size={20} className={color.replace("bg-", "text-")} />
    </div>
    <div className="min-w-0">
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-white truncate">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const AiBar = ({ score }) => {
  const pct = Math.min(100, Math.max(0, score || 0));
  const color = pct >= 70 ? "bg-rose-500" : pct >= 40 ? "bg-amber-400" : "bg-emerald-500";
  const label = pct >= 70 ? "High Risk" : pct >= 40 ? "Moderate" : "Low Risk";
  const labelColor = pct >= 70 ? "text-rose-400" : pct >= 40 ? "text-amber-400" : "text-emerald-400";
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-400">AI Probability</span>
        <span className={`text-sm font-bold ${labelColor}`}>{pct}% — {label}</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2.5">
        <div className={`h-2.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const SignalRow = ({ label, score, detail }) => {
  const pct = Math.min(100, Math.max(0, Math.round((score || 0) * 100)));
  const color = pct >= 70 ? "bg-rose-500" : pct >= 40 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="py-3 border-b border-slate-700/50 last:border-0">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm text-slate-300 capitalize">{label.replace(/_/g, " ")}</span>
        <span className="text-xs text-slate-400 font-mono">{pct}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {detail && <p className="text-xs text-slate-500 mt-1">{detail}</p>}
    </div>
  );
};

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

  const duration = session.activeDuration || (session.totalDuration ? session.totalDuration / 1000 : 0) || session.stats?.duration || 0;
  const keystrokes = session.totalKeystrokes || session.stats?.keystrokes || 0;
  const pastes = session.totalPastes || session.behavioralSignals?.pasteCount || 0;
  const filesEdited = session.filesEdited || [];
  const languagesUsed = session.languagesUsed || (session.language ? [session.language] : []);
  const signals = session.aiDetection?.signals || {};
  const aiScore = session.stats?.aiProbability ?? session.aiDetection?.aiLikelihoodScore ?? null;
  const skillLevel = session.stats?.skillLevel;
  const isActive = session.status === "active";

  const skillColor = skillLevel === "Advanced" ? "bg-emerald-500" : skillLevel === "Intermediate" ? "bg-blue-500" : "bg-slate-500";
  const langColors = ["bg-indigo-500/20 text-indigo-300 border-indigo-500/30", "bg-cyan-500/20 text-cyan-300 border-cyan-500/30", "bg-violet-500/20 text-violet-300 border-violet-500/30", "bg-pink-500/20 text-pink-300 border-pink-500/30"];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">

      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="p-2 mt-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white">Session Analysis</h1>
            <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 font-mono">{session.id.slice(0, 16)}…</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-slate-600/30"}`}>
              {isActive ? "● Active" : "Completed"}
            </span>
            {session.sessionType && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-indigo-500/10 text-indigo-400 border-indigo-500/20 capitalize">
                {session.sessionType}
              </span>
            )}
          </div>
          <p className="text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mt-1">
            <span className="flex items-center gap-1"><User size={13} /> {session.email}</span>
            {session.timestamp?.seconds && (
              <span className="flex items-center gap-1"><Calendar size={13} /> {new Date(session.timestamp.seconds * 1000).toLocaleString()}</span>
            )}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Time Taken"    value={formatDuration(duration)}  icon={Clock}     color="bg-orange-500" sub={session.idleDuration ? `Idle: ${formatDuration(session.idleDuration)}` : null} />
        <StatCard label="Keystrokes"    value={keystrokes.toLocaleString()} icon={Keyboard}  color="bg-blue-500" />
        <StatCard label="Pastes"        value={pastes}                     icon={Clipboard}  color="bg-amber-500" sub="Clipboard paste events" />
        <StatCard label="Files Edited"  value={filesEdited.length || session.stats?.filesCount || "—"} icon={FileCode}  color="bg-violet-500" />
        <StatCard label="Languages"     value={languagesUsed.length || "—"} icon={Layers}    color="bg-cyan-500" />
        <StatCard label="Skill Level"   value={skillLevel || "N/A"}        icon={Brain}      color={skillColor} />
      </motion.div>

      {/* AI Detection */}
      {aiScore !== null && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-rose-400" />
            <h2 className="text-base font-bold text-white">AI Detection</h2>
            {session.aiDetection?.recommendation && (
              <span className="ml-auto text-xs text-slate-400 italic">{session.aiDetection.recommendation}</span>
            )}
          </div>

          <AiBar score={aiScore} />

          {Object.keys(signals).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Signal Breakdown</p>
              <div className="divide-y divide-slate-700/50">
                {Object.entries(signals).map(([key, val]) => (
                  <SignalRow
                    key={key}
                    label={key}
                    score={typeof val === "object" ? val.score ?? val.value ?? 0 : val}
                    detail={typeof val === "object" ? val.description || val.detail || null : null}
                  />
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Behavioral Signals */}
      {session.behavioralSignals && Object.keys(session.behavioralSignals).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Zap size={18} className="text-amber-400" />
            <h2 className="text-base font-bold text-white">Behavioral Signals</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(session.behavioralSignals).map(([key, val]) => (
              <div key={key} className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-white">{typeof val === "number" ? val : typeof val === "boolean" ? (val ? "Yes" : "No") : String(val)}</p>
                <p className="text-xs text-slate-500 mt-1 capitalize">{key.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Languages Used */}
      {languagesUsed.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch size={18} className="text-cyan-400" />
            <h2 className="text-base font-bold text-white">Languages Used</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {languagesUsed.map((lang, i) => (
              <span key={lang} className={`px-3 py-1.5 rounded-full text-sm font-semibold border capitalize ${langColors[i % langColors.length]}`}>
                {lang}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Files Edited */}
      {filesEdited.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileCode size={18} className="text-violet-400" />
            <h2 className="text-base font-bold text-white">Files Edited</h2>
            <span className="ml-auto text-xs text-slate-500">{filesEdited.length} file{filesEdited.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
            {filesEdited.map((file, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2">
                <CodeIcon size={13} className="text-slate-500 shrink-0" />
                <span className="text-sm font-mono text-slate-300 truncate">{file}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Code Viewer */}
      {session.code && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#0f1117] rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
          <div className="bg-slate-900/80 px-4 py-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-400">
              <CodeIcon size={16} />
              <span className="text-sm font-mono">{session.fileName || "script"}</span>
            </div>
            <span className="text-xs text-blue-400 font-bold uppercase tracking-wider">{session.language}</span>
          </div>
          <div className="p-6 overflow-x-auto max-h-[500px] overflow-y-auto">
            <pre className="font-mono text-sm text-emerald-300 leading-relaxed">
              <code>{session.code}</code>
            </pre>
          </div>
        </motion.div>
      )}

      {/* AI Detection Tips */}
      {session.stats?.tips?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-4">Analysis Notes</h2>
          <ul className="space-y-2">
            {session.stats.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                <span className="text-indigo-400 font-bold mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
};

export default SessionDetail;
