import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, ShieldCheck, ShieldAlert, Clock, Keyboard, Calendar, Code2 } from "lucide-react";
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
          // Only allow users to view their own sessions
          if (data.userId === user?.uid) {
            setSession(data);
          }
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
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
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
  const confidence = aiDetection?.confidence || 0;

  // Prepare chart data from signals
  const barChartData = signals
    ? Object.entries(signals).map(([key, signal]) => ({
        name: signal.name,
        score: signal.score,
        verdict: signal.verdict,
        fill: VERDICT_COLORS[signal.verdict] || "#64748b"
      }))
    : [];

  const radarData = signals
    ? Object.entries(signals).map(([key, signal]) => ({
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

  // Determine overall result color and label
  const getResultStyle = (score) => {
    if (score > 70) return { color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30", label: "High AI Likelihood" };
    if (score > 40) return { color: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/30", label: "Moderate AI Indicators" };
    return { color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30", label: "Human Written" };
  };

  const resultStyle = getResultStyle(likelihoodScore);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-8">
      {/* Back Button */}
      <button
        onClick={() => navigate("/user/history")}
        className="text-slate-400 hover:text-white flex items-center gap-2 transition"
      >
        <ArrowLeft size={20} /> Back to Sessions
      </button>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          {likelihoodScore > 50 ? (
            <ShieldAlert className="text-red-400" size={32} />
          ) : (
            <ShieldCheck className="text-green-400" size={32} />
          )}
          AI Detection Results
        </h1>
        <p className="text-slate-400 mt-2">
          Detailed analysis of your coding session behavior.
        </p>
      </div>

      {/* Session Info Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex flex-wrap items-center gap-6"
      >
        <div className="flex items-center gap-2 text-slate-300">
          <Code2 size={16} className="text-indigo-400" />
          <span className="font-medium">
            {session.fileName || session.language || "Unknown"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Calendar size={16} />
          {sessionTime
            ? new Date(sessionTime.seconds * 1000).toLocaleDateString()
            : "Unknown date"}
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Clock size={16} />
          {duration ? `${Math.round(duration)}s` : "N/A"}
        </div>
        {(session.stats?.keystrokes || session.totalKeystrokes) && (
          <div className="flex items-center gap-2 text-slate-400">
            <Keyboard size={16} />
            {session.stats?.keystrokes || session.totalKeystrokes} keystrokes
          </div>
        )}
      </motion.div>

      {/* Overall Result - BOLD */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className={`${resultStyle.bg} border ${resultStyle.border} rounded-2xl p-8 text-center`}
      >
        <p className="text-slate-400 text-sm uppercase tracking-wider mb-2">Overall AI Likelihood Score</p>
        <p className={`text-6xl font-extrabold ${resultStyle.color} mb-2`}>
          {likelihoodScore.toFixed(1)}%
        </p>
        <p className={`text-xl font-bold ${resultStyle.color}`}>
          {resultStyle.label}
        </p>
        {confidence > 0 && (
          <p className="text-slate-500 text-sm mt-2">Analysis Confidence: {confidence}%</p>
        )}
        {aiDetection?.recommendation && (
          <p className="text-slate-300 font-bold text-lg mt-4 max-w-2xl mx-auto">
            {aiDetection.recommendation}
          </p>
        )}
      </motion.div>

      {/* Charts Section */}
      {signals && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-white mb-4">Signal Scores</h2>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={barChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fill: "#cbd5e1", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "12px",
                    color: "#e2e8f0"
                  }}
                  formatter={(value, name, props) => [
                    `${value}/100 (${VERDICT_LABELS[props.payload.verdict] || "N/A"})`,
                    "Score"
                  ]}
                />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={20}>
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
            transition={{ delay: 0.3 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-white mb-4">Behavior Overview</h2>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#475569" />
                <PolarAngleAxis dataKey="signal" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.3}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: "12px",
                    color: "#e2e8f0"
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      {/* Signal Breakdown List */}
      {signals && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-6"
        >
          <h2 className="text-lg font-bold text-white mb-4">Detailed Signal Breakdown</h2>
          <div className="space-y-4">
            {Object.entries(signals).map(([key, signal]) => (
              <div key={key} className="bg-slate-900/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{signal.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      signal.verdict === "ai_likely" ? "bg-red-500/20 text-red-400" :
                      signal.verdict === "suspicious" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-green-500/20 text-green-400"
                    }`}>
                      {VERDICT_LABELS[signal.verdict] || signal.verdict}
                    </span>
                  </div>
                  <span className={`text-sm font-extrabold ${
                    signal.verdict === "ai_likely" ? "text-red-400" :
                    signal.verdict === "suspicious" ? "text-yellow-400" : "text-green-400"
                  }`}>
                    {signal.score}/100
                  </span>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden mb-2">
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
                <p className="text-xs text-slate-400">{signal.description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* No AI Detection Data Fallback */}
      {!signals && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center"
        >
          <ShieldCheck size={64} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-xl font-semibold text-slate-300 mb-2">No Detailed Analysis Available</h3>
          <p className="text-slate-500">Detailed signal breakdown is not available for this session.</p>
        </motion.div>
      )}
    </div>
  );
};

export default UserSessionDetail;
