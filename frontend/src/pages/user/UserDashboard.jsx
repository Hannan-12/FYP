import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Added navigate
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Code, TrendingUp, CheckCircle, Activity, PieChart as PieIcon, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: delay }}
    className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-6 rounded-2xl shadow-xl hover:shadow-2xl hover:border-indigo-500/30 transition-all duration-300 group"
  >
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
    </div>
  </motion.div>
);

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ total: 0, accuracy: 0, skill: "N/A" });
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (!user) {
      console.log("⚠️ Dashboard: No user authenticated");
      return;
    }

    console.log("📊 Dashboard: Fetching sessions for user:", user.uid);

    const q = query(
      collection(db, "sessions"),
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`✅ Dashboard: Loaded ${data.length} sessions`);
        setSessions(data);

        if (data.length > 0) {
          const avgAcc = 100 - (data.reduce((acc, curr) => acc + (curr.stats?.aiProbability || 0), 0) / data.length);
          setStats({
            total: data.length,
            accuracy: Math.round(avgAcc),
            skill: data[0].stats?.skillLevel || "N/A"
          });

          const skills = { Beginner: 0, Intermediate: 0, Advanced: 0 };
          data.forEach(s => {
            const level = s.stats?.skillLevel || "Beginner";
            if (skills[level] !== undefined) skills[level]++;
          });

          const formattedData = [
            { name: "Beginner", value: skills.Beginner },
            { name: "Intermediate", value: skills.Intermediate },
            { name: "Advanced", value: skills.Advanced }
          ].filter(item => item.value > 0);

          setChartData(formattedData);
        } else {
          console.log("ℹ️ Dashboard: No sessions found. Complete quests to populate data.");
        }
      },
      (error) => {
        console.error("❌ Dashboard: Error fetching sessions:", error);
        if (error.code === 'permission-denied') {
          console.error("🔒 Permission denied. Check Firestore security rules.");
        } else if (error.code === 'failed-precondition') {
          console.error("📑 Missing Firestore index. Check Firebase console for index creation link.");
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  const COLORS = ["#94a3b8", "#3b82f6", "#10b981"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-2">Welcome back, check your performance overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Sessions" value={stats.total} icon={Code} color="bg-blue-500" delay={0.1} />
        <StatCard title="Authenticity" value={`${stats.accuracy}%`} icon={CheckCircle} color="bg-green-500" delay={0.2} />
        <StatCard title="Current Level" value={stats.skill} icon={TrendingUp} color="bg-purple-500" delay={0.3} />
        
        {/* Gamified Level Up Card */}
        <motion.div 
          onClick={() => navigate("/user/quests")}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="cursor-pointer bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-2xl shadow-xl hover:scale-105 transition-transform flex flex-col justify-between group"
        >
          <div>
            <p className="text-white/70 text-sm font-medium">Ready to grow?</p>
            <h3 className="text-xl font-bold text-white">Unlock New Quests</h3>
          </div>
          <div className="flex justify-end">
            <Zap className="text-yellow-400 group-hover:animate-pulse" size={24} />
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl overflow-hidden shadow-xl"
        >
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity size={20} className="text-indigo-400" />
              Recent Activity
            </h2>
          </div>
          <div className="divide-y divide-slate-700/50 max-h-[400px] overflow-y-auto">
            {sessions.length > 0 ? (
              sessions.map((session) => (
                <div key={session.id} className="p-4 hover:bg-slate-700/30 transition flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-200 capitalize">{session.language} Practice</p>
                    <p className="text-xs text-slate-500">
                      {session.timestamp ? new Date(session.timestamp.seconds * 1000).toLocaleString() : "Just now"}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {session.stats?.skillLevel || "N/A"}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <Code size={48} className="mx-auto text-slate-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-400 mb-2">No activity yet</h3>
                <p className="text-slate-500 text-sm mb-4">Complete your first quest to start tracking your progress</p>
                <button
                  onClick={() => navigate("/user/quests")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                >
                  <Zap size={16} />
                  Start Your First Quest
                </button>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl shadow-xl p-6"
        >
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <PieIcon size={20} className="text-purple-400" />
            Skill Breakdown
          </h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center">
              <div className="text-center">
                <TrendingUp size={40} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-500 text-sm">Complete quests to see your skill distribution</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default UserDashboard;