import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft, ShieldCheck, ShieldAlert, Clock, Keyboard, Calendar,
  Code2, Brain, Lightbulb, TrendingUp, Activity, Target, Star
} from "lucide-react";
import { motion } from "framer-motion";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const VERDICT_COLORS = {
  ai_likely: "#ef4444",
  suspicious: "#eab308",
  human: "#22c55e"
};

const VERDICT_LABELS = {
  ai_likely: "AI LIKELY",
  suspicious: "SUSPICIOUS",
  human: "HUMAN"
};

const SKILL_CONFIG = {
  Advanced:     { color: "text-purple-400", bg: "bg-purple-500/15", border: "border-purple-500/30", bar: "bg-purple-500", icon: "🚀" },
  Intermediate: { color: "text-blue-400",   bg: "bg-blue-500/15",   border: "border-blue-500/30",   bar: "bg-blue-500",   icon: "⚡" },
  Beginner:     { color: "text-green-400",  bg: "bg-green-500/15",  border: "border-green-500/30",  bar: "bg-green-500",  icon: "🌱" }
};

const UserSessionDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const docSnap = await getDoc(doc(db, "sessions", id));
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          if (data.userId === user?.uid) setSession(data);
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
      } finally {
        setLoading(false);
      }
    };
    if (user?.uid) fetchSession();
  }, [id, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-10 text-center text-slate-500">
        Session not found or you don't have access.
      </div>
    );
  }

  const aiDetection = session.aiDetection;
  const signals = aiDetection?.signals;
  const likelihoodScore = aiDetection?.aiLikelihoodScore || session.stats?.aiProbability || 0;
  const aiConfidence = aiDetection?.confidence || 0;
  const skillLevel = session.stats?.skillLevel;
  const skillConf = session.stats?.confidence || 0;
  const skillCfg = SKILL_CONFIG[skillLevel] || SKILL_CONFIG.Beginner;

  const barChartData = signals
    ? Object.entries(signals).map(([, signal]) => ({
        name: signal.name,
        score: signal.score,
        verdict: signal.verdict,
        fill: VERDICT_COLORS[signal.verdict] || "#64748b"
      }))
    : [];

  const radarData = signals
    ? Object.entries(signals).map(([, signal]) => ({
        signal: signal.name.replace("Typing ", "").replace(" Ratio", "").replace(" Pattern", ""),
        score: signal.score,
        fullMark: 100
      }))
    : [];

  const sessionTime = session.timestamp || session.startTime;
  const isExtension = session.sessionType === "extension";
  const duration = isExtension
    ? session.totalDuration || session.activeDuration
    : session.stats?.duration;

  const getAIStyle = (score) => {
    if (score > 70) return { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", bar: "bg-red-500", label: "High AI Likelihood", icon: ShieldAlert };
    if (score > 40) return { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", bar: "bg-yellow-500", label: "Moderate Indicators", icon: ShieldAlert };
    return { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", bar: "bg-green-500", label: "Human Written", icon: ShieldCheck };
  };

  const aiStyle = getAIStyle(likelihoodScore);
  const AIIcon = aiStyle.icon;

  // Combine tips from both sources
  const tips = session.stats?.tips || [];
  const aiRecommendation = aiDetection?.recommendation;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">

      {/* Back Button */}
      <button
        onClick={() => navigate("/user/history")}
        className="text-slate-400 hover:text-white flex items-center gap-2 transition"
      >
        <ArrowLeft size={18} /> Back to Sessions
      </button>

      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Activity className="text-indigo-400" size={30} />
            Session Analysis Report
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            AI detection & skill assessment for your coding session
          </p>
        </div>
        {/* Session meta chips */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5">
            <Code2 size={13} className="text-indigo-400" />
            {session.fileName || session.language || "Unknown"}
          </span>
          <span className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5">
            <Calendar size={13} />
            {sessionTime ? new Date(sessionTime.seconds * 1000).toLocaleDateString() : "N/A"}
          </span>
          <span className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5">
            <Clock size={13} />
            {duration ? `${Math.round(duration)}s` : "N/A"}
          </span>
          {(session.stats?.keystrokes || session.totalKeystrokes) && (
            <span className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5">
              <Keyboard size={13} />
              {session.stats?.keystrokes || session.totalKeystrokes} keystrokes
            </span>
          )}
        </div>
      </div>

      {/* ── Hero: AI Detection + Skill Analysis side-by-side ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* AI Detection Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`${aiStyle.bg} border ${aiStyle.border} rounded-2xl p-7 flex flex-col gap-4`}
        >
          <div className="flex items-center gap-2">
            <AIIcon className={aiStyle.color} size={20} />
            <h2 className="font-bold text-white text-base">AI Detection</h2>
            {aiConfidence > 0 && (
              <span className="ml-auto text-[11px] text-slate-500">
                Confidence: {aiConfidence}%
              </span>
            )}
          </div>

          {/* Big score */}
          <div className="text-center py-2">
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">AI Likelihood</p>
            <p className={`text-6xl font-extrabold ${aiStyle.color}`}>
              {likelihoodScore.toFixed(1)}%
            </p>
            <span className={`mt-2 inline-block text-xs font-bold px-3 py-1 rounded-full ${aiStyle.bg} border ${aiStyle.border} ${aiStyle.color}`}>
              {aiStyle.label}
            </span>
          </div>

          {/* Score bar */}
          <div>
            <div className="h-2.5 bg-slate-700/60 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(likelihoodScore, 100)}%` }}
                transition={{ duration: 0.9, delay: 0.3 }}
                className={`h-full rounded-full ${aiStyle.bar}`}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>

          {aiRecommendation && (
            <p className="text-slate-300 text-sm leading-relaxed border-t border-slate-700/50 pt-3">
              {aiRecommendation}
            </p>
          )}
        </motion.div>

        {/* Skill Analysis Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`${skillLevel ? skillCfg.bg : "bg-slate-800/60"} border ${skillLevel ? skillCfg.border : "border-slate-700"} rounded-2xl p-7 flex flex-col gap-4`}
        >
          <div className="flex items-center gap-2">
            <Brain className="text-indigo-400" size={20} />
            <h2 className="font-bold text-white text-base">Skill Analysis</h2>
          </div>

          {skillLevel ? (
            <>
              {/* Big skill level */}
              <div className="text-center py-2">
                <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Detected Level</p>
                <p className="text-5xl mb-1">{skillCfg.icon}</p>
                <p className={`text-4xl font-extrabold ${skillCfg.color}`}>{skillLevel}</p>
                {skillConf > 0 && (
                  <span className={`mt-2 inline-block text-xs font-bold px-3 py-1 rounded-full ${skillCfg.bg} border ${skillCfg.border} ${skillCfg.color}`}>
                    {skillConf.toFixed(1)}% confidence
                  </span>
                )}
              </div>

              {/* Confidence bar */}
              {skillConf > 0 && (
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Model Confidence</span>
                    <span className={skillCfg.color}>{skillConf.toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-700/60 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${skillConf}%` }}
                      transition={{ duration: 0.9, delay: 0.4 }}
                      className={`h-full rounded-full ${skillCfg.bar}`}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-3">
              <Brain size={48} className="text-slate-600" />
              <p className="text-slate-400 text-sm">No skill data available for this session.</p>
              <p className="text-slate-500 text-xs">Complete a session with code tracking for skill analysis.</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Quick Insight Chips ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        {[
          {
            icon: <TrendingUp size={16} className="text-indigo-400" />,
            label: "Skill Level",
            value: skillLevel || "N/A",
            color: skillLevel ? skillCfg.color : "text-slate-400"
          },
          {
            icon: <ShieldCheck size={16} className="text-green-400" />,
            label: "Authenticity",
            value: `${(100 - likelihoodScore).toFixed(0)}%`,
            color: likelihoodScore < 40 ? "text-green-400" : likelihoodScore < 70 ? "text-yellow-400" : "text-red-400"
          },
          {
            icon: <Target size={16} className="text-blue-400" />,
            label: "AI Probability",
            value: `${likelihoodScore.toFixed(0)}%`,
            color: aiStyle.color
          },
          {
            icon: <Star size={16} className="text-yellow-400" />,
            label: "Signals Analyzed",
            value: signals ? Object.keys(signals).length : "—",
            color: "text-yellow-400"
          }
        ].map((chip, i) => (
          <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">{chip.icon}{chip.label}</div>
            <p className={`text-xl font-extrabold ${chip.color}`}>{chip.value}</p>
          </div>
        ))}
      </motion.div>

      {/* ── Charts ── */}
      {signals && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6"
          >
            <h2 className="text-base font-bold text-white mb-1">Signal Scores</h2>
            <p className="text-xs text-slate-500 mb-4">Individual AI detection signal breakdown</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fill: "#cbd5e1", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "12px", color: "#e2e8f0" }}
                  formatter={(value, , props) => [
                    `${value}/100 — ${VERDICT_LABELS[props.payload.verdict] || "N/A"}`,
                    "Score"
                  ]}
                />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={18}>
                  {barChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Radar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6"
          >
            <h2 className="text-base font-bold text-white mb-1">Behavior Overview</h2>
            <p className="text-xs text-slate-500 mb-4">Behavioral pattern radar across all signals</p>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
                <PolarGrid stroke="#475569" />
                <PolarAngleAxis dataKey="signal" tick={{ fill: "#cbd5e1", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 9 }} />
                <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "12px", color: "#e2e8f0" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      {/* ── Detailed Signal Breakdown ── */}
      {signals && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-6"
        >
          <h2 className="text-base font-bold text-white mb-1">Detailed Signal Breakdown</h2>
          <p className="text-xs text-slate-500 mb-5">Each signal contributes to the overall AI likelihood score</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(signals).map(([key, signal]) => (
              <div key={key} className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white truncate pr-2">{signal.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    signal.verdict === "ai_likely" ? "bg-red-500/20 text-red-400" :
                    signal.verdict === "suspicious" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-green-500/20 text-green-400"
                  }`}>
                    {VERDICT_LABELS[signal.verdict] || signal.verdict}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(signal.score, 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                      className={`h-full rounded-full ${
                        signal.verdict === "ai_likely" ? "bg-red-500" :
                        signal.verdict === "suspicious" ? "bg-yellow-500" : "bg-green-500"
                      }`}
                    />
                  </div>
                  <span className={`text-xs font-extrabold shrink-0 ${
                    signal.verdict === "ai_likely" ? "text-red-400" :
                    signal.verdict === "suspicious" ? "text-yellow-400" : "text-green-400"
                  }`}>
                    {signal.score}/100
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{signal.description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Combined Recommendations ── */}
      {(tips.length > 0 || aiRecommendation) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-800 border border-indigo-500/30 rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <Lightbulb className="text-yellow-400" size={20} />
            <h2 className="text-base font-bold text-white">Personalized Recommendations</h2>
          </div>
          <div className="space-y-3">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-3 bg-slate-900/50 rounded-xl p-4">
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-slate-300 text-sm leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Fallback: no AI detection data ── */}
      {!signals && !skillLevel && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center"
        >
          <ShieldCheck size={64} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-xl font-semibold text-slate-300 mb-2">No Analysis Available</h3>
          <p className="text-slate-500">Complete a longer coding session with tracking enabled to see your analysis.</p>
        </motion.div>
      )}
    </div>
  );
};

export default UserSessionDetail;
