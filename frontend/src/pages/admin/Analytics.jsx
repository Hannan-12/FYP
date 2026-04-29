import { useEffect, useState, useMemo } from "react";
import { db } from "../../firebase/config";
import { collection, getDocs } from "firebase/firestore";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, AreaChart, Area
} from "recharts";
import { motion } from "framer-motion";
import { Brain, Clock, Code, ShieldAlert, Users, Activity } from "lucide-react";

const TOOLTIP_STYLE = { backgroundColor: "#1e293b", border: "none", borderRadius: "8px", color: "#fff", fontSize: 12 };
const TOOLTIP_PROPS = { contentStyle: TOOLTIP_STYLE, itemStyle: { color: "#fff" }, labelStyle: { color: "#fff" } };
const GRID_COLOR = "#334155";

const Card = ({ title, subtitle, children, delay = 0, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className={`bg-slate-800/40 backdrop-blur-md border border-slate-700 p-6 rounded-2xl shadow-xl ${className}`}
  >
    <div className="mb-5">
      <h2 className="text-base font-bold text-slate-200">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </motion.div>
);

const StatPill = ({ label, value, icon: Icon, color }) => (
  <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 flex items-center gap-4">
    <div className={`p-3 rounded-xl bg-opacity-10 ${color} shrink-0`}>
      <Icon size={20} className={color.replace("bg-", "text-")} />
    </div>
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  </div>
);

const Analytics = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const snap = await getDocs(collection(db, "sessions"));
        setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, []);

  // ── Derived data ──────────────────────────────────────────────────
  const completed = useMemo(() => sessions.filter(s => s.status === "completed"), [sessions]);

  // 1. Skill distribution
  const skillData = useMemo(() => {
    const counts = { Beginner: 0, Intermediate: 0, Advanced: 0 };
    completed.forEach(s => { if (s.stats?.skillLevel) counts[s.stats.skillLevel]++; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [completed]);

  // 2. Daily sessions (last 30 days)
  const activityData = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      const ts = s.timestamp || s.startTime;
      if (!ts?.seconds) return;
      const date = new Date(ts.seconds * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      map[date] = (map[date] || 0) + 1;
    });
    return Object.entries(map).slice(-30).map(([date, count]) => ({ date, sessions: count }));
  }, [sessions]);

  // 3. Language breakdown
  const languageData = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      const langs = s.languagesUsed?.length ? s.languagesUsed : s.language ? [s.language] : [];
      langs.forEach(l => { if (l) map[l] = (map[l] || 0) + 1; });
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }));
  }, [sessions]);

  // 4. AI score distribution buckets
  const aiDistData = useMemo(() => {
    const buckets = { "0–20": 0, "21–40": 0, "41–60": 0, "61–80": 0, "81–100": 0 };
    completed.forEach(s => {
      const score = s.stats?.aiProbability;
      if (score == null) return;
      if (score <= 20)      buckets["0–20"]++;
      else if (score <= 40) buckets["21–40"]++;
      else if (score <= 60) buckets["41–60"]++;
      else if (score <= 80) buckets["61–80"]++;
      else                  buckets["81–100"]++;
    });
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [completed]);

  // 5. Avg session duration per day (line chart)
  const durationTrendData = useMemo(() => {
    const map = {};
    completed.forEach(s => {
      const ts = s.timestamp || s.startTime;
      if (!ts?.seconds) return;
      const date = new Date(ts.seconds * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const dur = s.activeDuration || (s.totalDuration ? s.totalDuration / 1000 : 0) || s.stats?.duration || 0;
      if (!map[date]) map[date] = { total: 0, count: 0 };
      map[date].total += dur;
      map[date].count++;
    });
    return Object.entries(map).slice(-21).map(([date, { total, count }]) => ({
      date,
      avgMin: parseFloat((total / count / 60).toFixed(1))
    }));
  }, [completed]);

  // 6. Behavioral radar — avg across all sessions
  const radarData = useMemo(() => {
    if (!completed.length) return [];
    const keys = ["totalPastes", "totalUndos", "totalRedos", "totalAutocompleteAccepts", "totalCopilotAccepts", "totalClipboardPastes"];
    const labels = ["Pastes", "Undos", "Redos", "Autocomplete", "Copilot", "Clipboard"];
    const avgs = keys.map((k, i) => {
      const avg = completed.reduce((acc, s) => acc + (s.behavioralSignals?.[k] || s[k] || 0), 0) / completed.length;
      return { subject: labels[i], value: parseFloat(avg.toFixed(1)) };
    });
    const max = Math.max(...avgs.map(a => a.value), 1);
    return avgs.map(a => ({ ...a, normalized: parseFloat(((a.value / max) * 100).toFixed(1)) }));
  }, [completed]);

  // ── Summary stats ─────────────────────────────────────────────────
  const totalStudents = useMemo(() => new Set(sessions.map(s => s.userId)).size, [sessions]);
  const avgDuration   = useMemo(() => {
    if (!completed.length) return 0;
    const total = completed.reduce((acc, s) => acc + (s.activeDuration || (s.totalDuration ? s.totalDuration / 1000 : 0) || s.stats?.duration || 0), 0);
    return Math.round(total / completed.length / 60);
  }, [completed]);
  const flagged       = useMemo(() => completed.filter(s => (s.stats?.aiProbability || 0) > 70).length, [completed]);
  const avgAI         = useMemo(() => {
    const withScore = completed.filter(s => s.stats?.aiProbability != null);
    if (!withScore.length) return 0;
    return Math.round(withScore.reduce((acc, s) => acc + s.stats.aiProbability, 0) / withScore.length);
  }, [completed]);

  const PIE_COLORS  = ["#94a3b8", "#3b82f6", "#10b981"];
  const BAR_COLORS  = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];
  const AI_COLORS   = { "0–20": "#10b981", "21–40": "#6366f1", "41–60": "#f59e0b", "61–80": "#f97316", "81–100": "#ef4444" };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading analytics...</div>;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400 mt-1 text-sm">Aggregated insights across all sessions and students.</p>
      </div>

      {/* Summary stat pills */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatPill label="Total Students"   value={totalStudents}       icon={Users}       color="bg-blue-500" />
        <StatPill label="Total Sessions"   value={sessions.length}     icon={Activity}    color="bg-emerald-500" />
        <StatPill label="Avg Duration"     value={`${avgDuration}m`}   icon={Clock}       color="bg-violet-500" />
        <StatPill label="Flagged (>70%)"   value={flagged}             icon={ShieldAlert} color="bg-rose-500" />
      </div>

      {/* Row 1 — Skill distribution + Language breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Skill Distribution" subtitle="Completed sessions by skill level" delay={0.1}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={skillData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                  {skillData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Top Languages" subtitle="Sessions count per language" delay={0.15}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={languageData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={72} />
                <Tooltip cursor={{ fill: "#334155", opacity: 0.4 }} {...TOOLTIP_PROPS} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                  {languageData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 2 — Daily sessions area + Avg duration line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Daily Session Volume" subtitle="Number of sessions started each day (last 30 days)" delay={0.2}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip {...TOOLTIP_PROPS} />
                <Area type="monotone" dataKey="sessions" stroke="#6366f1" strokeWidth={2} fill="url(#sessGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Avg Session Duration" subtitle="Average coding time per day in minutes (last 21 days)" delay={0.25}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={durationTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} unit="m" />
                <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [`${v} min`, "Avg Duration"]} />
                <Line type="monotone" dataKey="avgMin" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 3 — AI score distribution + Behavioral radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="AI Suspicion Score Distribution" subtitle="How many sessions fall in each score range" delay={0.3}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aiDistData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="range" stroke="#94a3b8" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: "#334155", opacity: 0.4 }} {...TOOLTIP_PROPS} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
                  {aiDistData.map((entry) => <Cell key={entry.range} fill={AI_COLORS[entry.range]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-slate-500">Avg AI score across all sessions:</span>
            <span className={`text-sm font-bold ${avgAI >= 70 ? "text-rose-400" : avgAI >= 40 ? "text-amber-400" : "text-emerald-400"}`}>
              {avgAI}%
            </span>
          </div>
        </Card>

        <Card title="Avg Behavioral Signals" subtitle="Average counts across all completed sessions" delay={0.35}>
          {radarData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke={GRID_COLOR} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Radar name="Avg" dataKey="normalized" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} strokeWidth={2} />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(_, __, props) => [`${props.payload.value}`, props.payload.subject]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Not enough data yet.</div>
          )}
          {/* Legend with raw avg values */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {radarData.map(d => (
              <div key={d.subject} className="text-center">
                <p className="text-sm font-bold text-white">{d.value}</p>
                <p className="text-xs text-slate-500">{d.subject}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
