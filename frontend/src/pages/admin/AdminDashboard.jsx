import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase/config";
import { collection, onSnapshot, query, orderBy, getDocs } from "firebase/firestore";
import { Users, Code, Clock, ShieldAlert, ChevronRight, Search } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="bg-slate-800/40 backdrop-blur-md border border-slate-700 p-6 rounded-2xl shadow-lg hover:border-blue-500/30 transition-all"
  >
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon size={24} className={color.replace("bg-", "text-")} />
      </div>
    </div>
  </motion.div>
);

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
};

const formatDate = (timestamp) => {
  if (!timestamp?.seconds) return "—";
  return new Date(timestamp.seconds * 1000).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
};

const PIE_COLORS = ["#94a3b8", "#3b82f6", "#10b981"];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      async (error) => {
        console.warn("onSnapshot failed, using fallback:", error.code);
        try {
          const snapshot = await getDocs(collection(db, "sessions"));
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          data.sort((a, b) => {
            const tA = a.timestamp?.seconds || a.startTime?.seconds || 0;
            const tB = b.timestamp?.seconds || b.startTime?.seconds || 0;
            return tB - tA;
          });
          setSessions(data);
        } catch (e) {
          console.error("Fallback failed:", e);
        }
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // --- Derived stats ---
  const stats = useMemo(() => {
    const totalStudents = new Set(sessions.map(s => s.userId)).size;
    const totalSessions = sessions.length;
    const completed = sessions.filter(s => s.status === "completed");
    const avgDuration = completed.length
      ? Math.round(completed.reduce((acc, s) => acc + (s.activeDuration || s.totalDuration / 1000 || 0), 0) / completed.length)
      : 0;
    const aiAlerts = sessions.filter(s => (s.stats?.aiProbability || 0) > 70).length;
    return { totalStudents, totalSessions, avgDuration, aiAlerts };
  }, [sessions]);

  // --- Chart data ---
  const skillData = useMemo(() => {
    const counts = { Beginner: 0, Intermediate: 0, Advanced: 0 };
    sessions.forEach(s => {
      const lvl = s.stats?.skillLevel;
      if (lvl && counts[lvl] !== undefined) counts[lvl]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [sessions]);

  const activityData = useMemo(() => {
    const timeline = {};
    sessions.forEach(s => {
      if (!s.timestamp?.seconds) return;
      const date = new Date(s.timestamp.seconds * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      timeline[date] = (timeline[date] || 0) + 1;
    });
    return Object.entries(timeline).slice(-14).map(([date, count]) => ({ date, sessions: count }));
  }, [sessions]);

  // --- Filtered table rows ---
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(s =>
      s.email?.toLowerCase().includes(q) ||
      s.language?.toLowerCase().includes(q)
    );
  }, [sessions, search]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Live Overview</h1>
        <p className="text-slate-400 mt-2">Real-time monitoring of student activities.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard title="Total Students"    value={stats.totalStudents} icon={Users}       color="bg-blue-500"    delay={0.1} />
        <StatCard title="Total Sessions"    value={stats.totalSessions} icon={Code}        color="bg-emerald-500" delay={0.2} />
        <StatCard title="Avg Session Time"  value={formatDuration(stats.avgDuration)}      icon={Clock}       color="bg-violet-500"  delay={0.3} />
        <StatCard title="AI Alerts (>70%)"  value={stats.aiAlerts}      icon={ShieldAlert} color="bg-rose-500"    delay={0.4} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/40 backdrop-blur-md border border-slate-700 p-6 rounded-2xl shadow-xl"
        >
          <h2 className="text-base font-bold text-slate-200 mb-4">Skill Distribution</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={skillData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {skillData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "8px", color: "#fff" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800/40 backdrop-blur-md border border-slate-700 p-6 rounded-2xl shadow-xl"
        >
          <h2 className="text-base font-bold text-slate-200 mb-4">Daily Sessions (last 14 days)</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: "#334155", opacity: 0.4 }} contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "8px", color: "#fff" }} />
                <Bar dataKey="sessions" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Sessions Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-slate-800/40 backdrop-blur-md border border-slate-700 rounded-2xl overflow-hidden shadow-xl"
      >
        <div className="p-6 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <h2 className="text-lg font-bold text-white">All Coding Sessions</h2>
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by email or language..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading live data...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500">{search ? "No sessions match your search." : "No sessions found."}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-medium">
                <tr>
                  <th className="p-4 pl-6">User</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Skill Level</th>
                  <th className="p-4">Language</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((session) => {
                  const isActive = session.status === "active";
                  const duration = session.activeDuration || (session.totalDuration ? session.totalDuration / 1000 : 0);
                  return (
                    <tr
                      key={session.id}
                      onClick={() => navigate(`/admin/session/${session.id}`)}
                      className="hover:bg-slate-700/30 transition cursor-pointer group"
                    >
                      <td className="p-4 pl-6 font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                          )}
                          {session.email}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-slate-500/10 text-slate-400 border-slate-600/30"
                        }`}>
                          {isActive ? "Active" : "Completed"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          session.stats?.skillLevel === "Advanced"    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          session.stats?.skillLevel === "Intermediate" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          session.stats?.skillLevel === "Beginner"    ? "bg-slate-500/10 text-slate-400 border-slate-500/20" :
                          "bg-slate-700/40 text-slate-500 border-slate-700"
                        }`}>
                          {session.stats?.skillLevel || "N/A"}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 capitalize">{session.language || "—"}</td>
                      <td className="p-4 text-slate-400 tabular-nums">{formatDuration(duration)}</td>
                      <td className="p-4 text-slate-500 text-sm tabular-nums whitespace-nowrap">{formatDate(session.timestamp)}</td>
                      <td className="p-4 text-right pr-6">
                        <ChevronRight size={18} className="ml-auto text-slate-600 group-hover:text-blue-400 transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
