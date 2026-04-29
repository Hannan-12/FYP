import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, orderBy, onSnapshot, getDocs, doc, getDoc } from "firebase/firestore";
import {
  Code, TrendingUp, TrendingDown, CheckCircle, Activity, PieChart as PieIcon,
  Zap, Globe, ArrowRight, Star, Flame, Trophy, Medal, Target
} from "lucide-react";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from "recharts";

// ── Constants ────────────────────────────────────────────────────────────────
const COLORS = ["#94a3b8", "#3b82f6", "#10b981"];
const TOOLTIP_STYLE = { backgroundColor: "#1e293b", border: "none", borderRadius: "8px", color: "#fff", fontSize: 12 };
const TOOLTIP_PROPS = { contentStyle: TOOLTIP_STYLE, itemStyle: { color: "#fff" }, labelStyle: { color: "#fff" } };

const BADGE_DEFS = [
  { id: "first_quest",     name: "First Steps",     icon: "🎯", check: (p) => p.questsCompleted >= 1 },
  { id: "quests_5",        name: "Getting Started",  icon: "🔥", check: (p) => p.questsCompleted >= 5 },
  { id: "quests_10",       name: "Quest Hunter",     icon: "🏹", check: (p) => p.questsCompleted >= 10 },
  { id: "quests_25",       name: "Quest Master",     icon: "👑", check: (p) => p.questsCompleted >= 25 },
  { id: "xp_100",          name: "Century",          icon: "💯", check: (p) => (p.totalXP || 0) >= 100 },
  { id: "xp_500",          name: "XP Legend",        icon: "⚡", check: (p) => (p.totalXP || 0) >= 500 },
  { id: "authentic_coder", name: "Authentic Coder",  icon: "🛡️", check: () => false },
  { id: "intermediate",    name: "Leveling Up",      icon: "📈", check: () => false },
  { id: "advanced",        name: "Elite Coder",      icon: "🚀", check: () => false },
];

// ── Sub-components ────────────────────────────────────────────────────────────
const StatCard = ({ title, value, icon: Icon, color, delay, onClick, sub }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    onClick={onClick}
    className={`bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:border-indigo-500/30 transition-all duration-300 group ${onClick ? "cursor-pointer" : ""}`}
  >
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={24} className={color.replace("bg-", "text-")} />
      </div>
    </div>
  </motion.div>
);

const getAIColor = (prob) => {
  if (prob <= 30) return "text-emerald-400";
  if (prob <= 60) return "text-yellow-400";
  return "text-rose-400";
};

// ── Main Component ────────────────────────────────────────────────────────────
const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ total: 0, accuracy: 0, skill: "N/A" });
  const [chartData, setChartData] = useState([]);
  const [langData, setLangData] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [profile, setProfile] = useState(null);
  const [leaderboardRank, setLeaderboardRank] = useState(null);
  const [rankTotal, setRankTotal] = useState(null);

  // ── Fetch userProfiles ──
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "userProfiles", user.uid))
      .then(snap => { if (snap.exists()) setProfile(snap.data()); })
      .catch(() => {});
  }, [user]);

  // ── Fetch leaderboard rank (only reads userProfiles, not all sessions) ──
  useEffect(() => {
    if (!user?.uid) return;
    getDocs(collection(db, "userProfiles"))
      .then(snap => {
        const rows = snap.docs.map(d => {
          const p = d.data();
          const uid = p.userId || d.id;
          const auth = 100 - (p.avgAIScore ?? 0);
          return { uid, score: (p.totalXP || 0) * (auth / 100) };
        }).sort((a, b) => b.score - a.score);
        const rank = rows.findIndex(r => r.uid === user.uid) + 1;
        setLeaderboardRank(rank > 0 ? rank : null);
        setRankTotal(rows.length);
      })
      .catch(() => {});
  }, [user]);

  // ── Sessions listener ──
  useEffect(() => {
    if (!user) return;

    const process = (data) => {
      setSessions(data);
      if (data.length === 0) return;

      // Authenticity from all sessions with aiProbability
      const withAI = data.filter(s => s.stats?.aiProbability != null);
      const accuracy = withAI.length > 0
        ? Math.round(100 - (withAI.reduce((acc, s) => acc + s.stats.aiProbability, 0) / withAI.length))
        : 100;

      // Skill level — most recent session with skillLevel
      const skill = data.find(s => s.stats?.skillLevel)?.stats?.skillLevel || "N/A";

      setStats({ total: data.length, accuracy, skill });

      // Skill pie
      const skills = { Beginner: 0, Intermediate: 0, Advanced: 0 };
      withAI.forEach(s => { const l = s.stats?.skillLevel || "Beginner"; if (l in skills) skills[l]++; });
      setChartData(
        [{ name: "Beginner", value: skills.Beginner }, { name: "Intermediate", value: skills.Intermediate }, { name: "Advanced", value: skills.Advanced }]
          .filter(i => i.value > 0)
      );

      // Language distribution
      const langCounts = {};
      data.forEach(s => {
        const langs = s.languagesUsed?.length ? s.languagesUsed : s.language ? [s.language] : [];
        langs.forEach(l => { const k = l.toLowerCase(); langCounts[k] = (langCounts[k] || 0) + 1; });
      });
      const total = Object.values(langCounts).reduce((a, b) => a + b, 0) || 1;
      setLangData(
        Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(([lang, count]) => ({ lang: lang.charAt(0).toUpperCase() + lang.slice(1), pct: Math.round((count / total) * 100) }))
      );

      // Activity trend — sessions per day last 14 days
      const dayMap = {};
      const now = Date.now();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now - i * 86400000);
        dayMap[d.toLocaleDateString(undefined, { month: "short", day: "numeric" })] = 0;
      }
      data.forEach(s => {
        const ts = s.timestamp?.seconds || s.startTime?.seconds;
        if (!ts) return;
        const d = new Date(ts * 1000);
        if (now - d.getTime() > 14 * 86400000) return;
        const key = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        if (key in dayMap) dayMap[key]++;
      });
      setActivityData(Object.entries(dayMap).map(([date, count]) => ({ date, sessions: count })));
    };

    let unsub;
    try {
      const q = query(collection(db, "sessions"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));
      unsub = onSnapshot(q,
        snap => process(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        async () => {
          try {
            const snap = await getDocs(query(collection(db, "sessions"), where("userId", "==", user.uid)));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (b.timestamp?.seconds || b.startTime?.seconds || 0) - (a.timestamp?.seconds || a.startTime?.seconds || 0));
            process(data);
          } catch (e) { console.error("Dashboard fallback failed:", e); }
        }
      );
    } catch (e) { console.error("Dashboard listener failed:", e); }
    return () => { if (unsub) unsub(); };
  }, [user]);

  // ── Derived values ──
  const level = profile ? Math.floor((profile.totalXP || 0) / 100) + 1 : null;
  const levelProgress = profile ? (profile.totalXP || 0) % 100 : 0;
  const xpToNext = 100 - levelProgress;

  // Authenticity trend: compare last 5 sessions vs overall
  const authTrend = useMemo(() => {
    const withAI = sessions.filter(s => s.stats?.aiProbability != null);
    if (withAI.length < 5) return null;
    const recent5Avg = withAI.slice(0, 5).reduce((a, s) => a + s.stats.aiProbability, 0) / 5;
    const overallAvg = withAI.reduce((a, s) => a + s.stats.aiProbability, 0) / withAI.length;
    // If recent AI score is lower → authenticity is improving
    return recent5Avg < overallAvg - 3 ? "up" : recent5Avg > overallAvg + 3 ? "down" : "stable";
  }, [sessions]);

  // Next milestone
  const nextMilestone = useMemo(() => {
    if (!profile) return null;
    const xp = profile.totalXP || 0;
    const quests = profile.questsCompleted || 0;
    const earnedIds = new Set((profile.badges || []).map(b => b.id));

    if (!earnedIds.has("first_quest") && quests === 0) return { label: "Complete your first quest", icon: "🎯" };
    if (!earnedIds.has("quests_5") && quests < 5)   return { label: `${5 - quests} more quest${5 - quests !== 1 ? "s" : ""} to earn 🔥 Getting Started`, icon: "🔥" };
    if (!earnedIds.has("xp_100") && xp < 100)       return { label: `${100 - xp} XP to earn 💯 Century badge`, icon: "💯" };
    if (!earnedIds.has("quests_10") && quests < 10) return { label: `${10 - quests} more quest${10 - quests !== 1 ? "s" : ""} to earn 🏹 Quest Hunter`, icon: "🏹" };
    if (!earnedIds.has("xp_500") && xp < 500)       return { label: `${500 - xp} XP to earn ⚡ XP Legend badge`, icon: "⚡" };
    if (!earnedIds.has("quests_25") && quests < 25) return { label: `${25 - quests} more quest${25 - quests !== 1 ? "s" : ""} to earn 👑 Quest Master`, icon: "👑" };
    return null;
  }, [profile]);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-2">Welcome back, <span className="text-white font-medium">{user?.email?.split("@")[0]}</span>. Here's your performance overview.</p>
      </div>

      {/* Next Milestone Banner */}
      {nextMilestone && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate("/user/quests")}
          className="cursor-pointer flex items-center gap-4 bg-indigo-500/10 border border-indigo-500/30 hover:border-indigo-500/60 rounded-2xl px-5 py-4 transition-all group"
        >
          <span className="text-2xl">{nextMilestone.icon}</span>
          <div className="flex-1">
            <p className="text-xs text-indigo-400 uppercase tracking-wider font-semibold mb-0.5">Next Milestone</p>
            <p className="text-white font-semibold">{nextMilestone.label}</p>
          </div>
          <ArrowRight size={18} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition" />
        </motion.div>
      )}

      {/* Row 1 — Session stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard title="Total Sessions"  value={stats.total}            icon={Code}        color="bg-blue-500"   delay={0.1} sub="all time" />
        <StatCard
          title="Authenticity"
          value={
            <span className="flex items-center gap-2">
              {stats.accuracy}%
              {authTrend === "up"   && <TrendingUp   size={18} className="text-emerald-400" />}
              {authTrend === "down" && <TrendingDown  size={18} className="text-rose-400" />}
            </span>
          }
          icon={CheckCircle}
          color="bg-green-500"
          delay={0.2}
          sub={authTrend === "up" ? "↑ improving recently" : authTrend === "down" ? "↓ declining recently" : "avg across all sessions"}
        />
        <StatCard
          title="Skill Level"
          value={stats.skill}
          icon={TrendingUp}
          color="bg-purple-500"
          delay={0.3}
          sub="AI-detected from sessions"
        />
        <StatCard title="Languages Used"  value={langData.length || "—"} icon={Globe}       color="bg-cyan-500"   delay={0.35} sub="detected so far" />
      </div>

      {/* Row 2 — Gamification */}
      {profile && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-6">
          {/* XP + Level progress */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="xl:col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star size={18} className="text-yellow-400" fill="currentColor" />
                <p className="text-white font-bold">Gamification Level {level}</p>
              </div>
              <span className="text-yellow-400 font-bold">{profile.totalXP || 0} XP total</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${levelProgress}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300"
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>{xpToNext} XP to Level {level + 1}</span>
              <span>{profile.questsCompleted || 0} quests completed</span>
            </div>
          </motion.div>

          {/* Leaderboard Rank */}
          <StatCard
            title="Leaderboard Rank"
            value={leaderboardRank ? `#${leaderboardRank}` : "—"}
            icon={Medal}
            color="bg-indigo-500"
            delay={0.45}
            sub={rankTotal ? `out of ${rankTotal} students` : "complete quests to rank"}
            onClick={() => navigate("/user/leaderboard")}
          />

          {/* Streak */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm font-medium mb-1">Daily Streak</p>
                <h3 className="text-3xl font-bold text-white">{profile.streak || 0}</h3>
                <p className="text-slate-500 text-xs mt-1">days in a row</p>
              </div>
              <div className="p-3 rounded-xl bg-orange-500 bg-opacity-10">
                <Flame size={24} className="text-orange-400" fill={(profile.streak || 0) > 0 ? "currentColor" : "none"} />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Quests CTA */}
      <motion.div
        onClick={() => navigate("/user/quests")}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.55 }}
        className="cursor-pointer bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-2xl shadow-xl hover:scale-[1.01] transition-transform flex items-center justify-between group"
      >
        <div>
          <p className="text-white/70 text-sm font-medium">Ready to grow?</p>
          <h3 className="text-xl font-bold text-white">Unlock New Quests & Earn XP</h3>
        </div>
        <div className="flex items-center gap-3">
          {(profile?.badges || []).length > 0 && (
            <span className="text-white/70 text-sm">{profile.badges.length} badge{profile.badges.length !== 1 ? "s" : ""} earned</span>
          )}
          <Zap className="text-yellow-400 group-hover:animate-pulse" size={28} />
        </div>
      </motion.div>

      {/* Activity Trend Chart */}
      {activityData.some(d => d.sessions > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58 }}
          className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity size={20} className="text-indigo-400" /> Coding Activity
            </h2>
            <span className="text-xs text-slate-500">Last 14 days</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [v, "Sessions"]} />
                <Area type="monotone" dataKey="sessions" stroke="#6366f1" strokeWidth={2} fill="url(#actGrad)" dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Recent Activity + Right column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="lg:col-span-2 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl overflow-hidden shadow-xl"
        >
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity size={20} className="text-indigo-400" /> Recent Activity
            </h2>
            {sessions.length > 0 && (
              <button onClick={() => navigate("/user/history")} className="text-xs text-indigo-400 hover:text-indigo-300 transition font-semibold flex items-center gap-1">
                View All <ArrowRight size={12} />
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-700/50 max-h-[420px] overflow-y-auto">
            {sessions.length > 0 ? sessions.slice(0, 15).map((session) => {
              const aiProb = session.stats?.aiProbability;
              const duration = session.activeDuration
                || (session.totalDuration ? session.totalDuration / 1000 : 0)
                || session.stats?.duration
                || (session.endTime?.seconds && session.startTime?.seconds ? session.endTime.seconds - session.startTime.seconds : 0);
              const mins = duration > 0 ? Math.floor(duration / 60) : null;
              return (
                <div
                  key={session.id}
                  onClick={() => navigate(`/user/session/${session.id}`)}
                  className="p-4 hover:bg-slate-700/30 transition flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-200 capitalize truncate">
                      {session.fileName?.replace(/\.\w+$/, "") || session.language || "Unknown"}
                      <span className="text-slate-500 font-normal ml-1 text-sm">
                        {session.sessionType === "extension" ? "· VS Code" : "· Quest"}
                      </span>
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-slate-500">
                        {(session.timestamp || session.startTime)
                          ? new Date((session.timestamp?.seconds || session.startTime?.seconds) * 1000).toLocaleString()
                          : "Just now"}
                      </p>
                      {mins !== null && <span className="text-xs text-slate-600">{mins}m</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {aiProb != null && (
                      <span className={`text-xs font-bold tabular-nums ${getAIColor(aiProb)}`}>
                        AI {aiProb.toFixed(0)}%
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      session.stats?.skillLevel === "Advanced"     ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      session.stats?.skillLevel === "Intermediate" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      session.stats?.skillLevel                    ? "bg-slate-500/10 text-slate-400 border-slate-500/20" :
                                                                     "bg-slate-700/40 text-slate-600 border-slate-700"
                    }`}>
                      {session.stats?.skillLevel || "N/A"}
                    </span>
                    <ArrowRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </div>
              );
            }) : (
              <div className="p-12 text-center">
                <Code size={48} className="mx-auto text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-400 mb-2">No activity yet</h3>
                <p className="text-slate-500 text-sm mb-4">Complete your first quest to start tracking your progress</p>
                <button
                  onClick={() => navigate("/user/quests")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                >
                  <Zap size={16} /> Start Your First Quest
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Skill Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl p-6"
          >
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
              <PieIcon size={18} className="text-purple-400" /> Skill Breakdown
              <span className="text-xs text-slate-500 font-normal ml-1">(AI-detected)</span>
            </h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_PROPS} />
                  <Legend verticalAlign="bottom" height={32} wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp size={32} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-500 text-xs">Complete quests to see your skill distribution</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Badges preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            onClick={() => navigate("/user/progress")}
            className="cursor-pointer bg-slate-800/50 backdrop-blur-md border border-slate-700 hover:border-yellow-500/30 rounded-2xl shadow-xl p-6 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy size={18} className="text-yellow-400" /> Badges
              </h2>
              <span className="text-xs text-yellow-400 opacity-0 group-hover:opacity-100 transition font-semibold flex items-center gap-1">
                View All <ArrowRight size={12} />
              </span>
            </div>
            {(profile?.badges || []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.badges.slice(0, 6).map((badge, i) => (
                  <div key={i} title={badge.description} className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1.5 rounded-lg">
                    <span className="text-base">{badge.icon || "🏆"}</span>
                    <span className="text-xs text-yellow-300 font-medium">{badge.name}</span>
                  </div>
                ))}
                {profile.badges.length > 6 && (
                  <div className="flex items-center px-2.5 py-1.5 rounded-lg bg-slate-700/50 text-slate-400 text-xs">
                    +{profile.badges.length - 6} more
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-2">
                <Trophy size={28} className="mx-auto text-slate-600 mb-2" />
                <p className="text-slate-500 text-xs">Complete quests to earn badges</p>
                {profile && (
                  <div className="mt-3 space-y-1">
                    {BADGE_DEFS.filter(b => b.check(profile)).length === 0 && (
                      <p className="text-indigo-400 text-xs font-medium">
                        {profile.questsCompleted > 0
                          ? `${profile.questsCompleted} quest${profile.questsCompleted !== 1 ? "s" : ""} done — keep going!`
                          : "Start your first quest!"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Language Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        onClick={() => navigate("/user/languages")}
        className="cursor-pointer bg-slate-800/50 backdrop-blur-md border border-slate-700 hover:border-cyan-500/40 rounded-2xl shadow-xl p-6 transition-all group"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Globe size={20} className="text-cyan-400" /> Language Activity
          </h2>
          <span className="flex items-center gap-1 text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition font-semibold">
            View Details <ArrowRight size={14} />
          </span>
        </div>
        {langData.length > 0 ? (
          <div className="space-y-3">
            {langData.slice(0, 3).map(({ lang, pct }, i) => {
              const colors = ["#06b6d4", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];
              return (
                <div key={lang}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 font-medium">{lang}</span>
                    <span className="text-slate-500">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.1 * i }}
                      className="h-2 rounded-full"
                      style={{ backgroundColor: colors[i % colors.length] }}
                    />
                  </div>
                </div>
              );
            })}
            {langData.length > 3 && <p className="text-slate-500 text-xs text-right">+{langData.length - 3} more languages</p>}
          </div>
        ) : (
          <div className="h-24 flex items-center justify-center">
            <div className="text-center">
              <Globe size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-slate-500 text-sm">Start coding to see language activity</p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default UserDashboard;
