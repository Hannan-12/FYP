import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { motion } from "framer-motion";
import { Globe, BarChart2, Code, Clock } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const COLORS = ["#06b6d4", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm shadow-xl">
      <p className="text-white font-semibold">{payload[0].name || payload[0].payload.lang}</p>
      <p className="text-slate-400">{payload[0].value}{payload[0].name ? "%" : " sessions"}</p>
    </div>
  );
};

const LanguageStats = () => {
  const { user } = useAuth();
  const [langData, setLangData] = useState([]);    // { lang, pct, sessions }
  const [loading, setLoading] = useState(true);
  const [totalSessions, setTotalSessions] = useState(0);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user?.uid) return;
      setLoading(true);
      try {
        let snap;
        try {
          const q = query(
            collection(db, "sessions"),
            where("userId", "==", user.uid),
            orderBy("timestamp", "desc")
          );
          snap = await getDocs(q);
        } catch {
          snap = await getDocs(query(collection(db, "sessions"), where("userId", "==", user.uid)));
        }

        const langCounts = {};
        snap.forEach(d => {
          const s = d.data();
          const langs = s.languagesUsed?.length ? s.languagesUsed : s.language ? [s.language] : [];
          langs.forEach(l => {
            const key = l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
            langCounts[key] = (langCounts[key] || 0) + 1;
          });
        });

        const total = Object.values(langCounts).reduce((a, b) => a + b, 0) || 1;
        setTotalSessions(snap.size);

        const sorted = Object.entries(langCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([lang, count]) => ({
            lang,
            sessions: count,
            pct: Math.round((count / total) * 100),
          }));

        setLangData(sorted);
      } catch (e) {
        console.error("LanguageStats fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [user]);

  const pieData = langData.map(d => ({ name: d.lang, value: d.pct }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Globe className="text-cyan-400" size={32} /> Language Activity
        </h1>
        <p className="text-slate-400 mt-1">Breakdown of your coding sessions by language.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Sessions", value: totalSessions, icon: Code, color: "text-blue-400" },
          { label: "Languages Used", value: langData.length, icon: Globe, color: "text-cyan-400" },
          { label: "Top Language", value: langData[0]?.lang || "—", icon: BarChart2, color: "text-purple-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 flex items-center gap-4"
          >
            <div className="p-3 bg-slate-700/50 rounded-xl">
              <Icon size={22} className={color} />
            </div>
            <div>
              <p className="text-slate-400 text-sm">{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {langData.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-16 text-center">
          <Globe size={48} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">No session data yet. Start coding to see your language stats.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Globe size={18} className="text-cyan-400" /> Distribution
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={70} outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}%`}
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <BarChart2 size={18} className="text-purple-400" /> Sessions per Language
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={langData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="lang" type="category" tick={{ fill: "#cbd5e1", fontSize: 13 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(99,102,241,0.08)" }} />
                <Bar dataKey="sessions" radius={[0, 6, 6, 0]}>
                  {langData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Detail table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl p-6"
          >
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={18} className="text-green-400" /> Detailed Breakdown
            </h2>
            <div className="space-y-3">
              {langData.map(({ lang, pct, sessions }, i) => (
                <div key={lang} className="flex items-center gap-4">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-slate-300 w-28 font-medium">{lang}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.05 * i }}
                      className="h-2 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <span className="text-slate-400 text-sm w-12 text-right">{pct}%</span>
                  <span className="text-slate-500 text-sm w-20 text-right">{sessions} session{sessions !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      )}
    </div>
  );
};

export default LanguageStats;
