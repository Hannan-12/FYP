import { useEffect, useState } from "react";
import { db } from "../../firebase/config";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { motion } from "framer-motion";

const Analytics = () => {
  const [data, setData] = useState({ skill: [], activity: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const q = query(collection(db, "sessions"), orderBy("timestamp", "asc"));
      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(doc => doc.data());

      const skills = { Beginner: 0, Intermediate: 0, Advanced: 0 };
      const timeline = {};
      
      sessions.forEach(s => {
        const level = s.stats?.skillLevel || "Beginner";
        if (skills[level] !== undefined) skills[level]++;
        const date = new Date(s.timestamp.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        timeline[date] = (timeline[date] || 0) + 1;
      });

      setData({
        skill: Object.keys(skills).map(k => ({ name: k, value: skills[k] })),
        activity: Object.keys(timeline).map(d => ({ date: d, sessions: timeline[d] }))
      });
      setLoading(false);
    };
    fetchData();
  }, []);

  const COLORS = ["#94a3b8", "#3b82f6", "#10b981"]; // Slate, Blue, Emerald

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white">Analytics Overview</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1 */}
        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="bg-slate-800/40 backdrop-blur-md border border-slate-700 p-6 rounded-2xl shadow-xl"
        >
          <h2 className="text-lg font-bold text-slate-200 mb-6">Skill Distribution</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={data.skill} 
                  cx="50%" cy="50%" 
                  innerRadius={60} outerRadius={80} 
                  paddingAngle={5} 
                  dataKey="value"
                  stroke="none"
                >
                  {data.skill.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Chart 2 */}
        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ delay: 0.1 }}
           className="bg-slate-800/40 backdrop-blur-md border border-slate-700 p-6 rounded-2xl shadow-xl"
        >
          <h2 className="text-lg font-bold text-slate-200 mb-6">Daily Activity</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.activity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{fill: '#334155', opacity: 0.4}} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Bar dataKey="sessions" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;