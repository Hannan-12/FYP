import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase/config";
import { collection, onSnapshot, query, orderBy, limit, getDocs } from "firebase/firestore";
import { Users, Code, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: delay }}
    className="bg-slate-800/40 backdrop-blur-md border border-slate-700 p-6 rounded-2xl shadow-lg hover:border-blue-500/30 transition-all group"
  >
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
    </div>
  </motion.div>
);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalStudents: 0, totalSessions: 0 });

  useEffect(() => {
    const processData = (sessionData) => {
      setSessions(sessionData);
      setStats({
        totalStudents: new Set(sessionData.map(s => s.userId)).size,
        totalSessions: sessionData.length
      });
      setLoading(false);
    };

    const q = query(collection(db, "sessions"), orderBy("timestamp", "desc"), limit(20));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sessionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        processData(sessionData);
      },
      async (error) => {
        console.warn("Admin dashboard: onSnapshot failed, using fallback:", error.code);
        try {
          const snapshot = await getDocs(collection(db, "sessions"));
          const sessionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          sessionData.sort((a, b) => {
            const timeA = a.timestamp?.seconds || a.startTime?.seconds || 0;
            const timeB = b.timestamp?.seconds || b.startTime?.seconds || 0;
            return timeB - timeA;
          });
          processData(sessionData.slice(0, 20));
        } catch (fallbackError) {
          console.error("Admin dashboard fallback failed:", fallbackError);
          setLoading(false);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Live Overview</h1>
        <p className="text-slate-400 mt-2">Real-time monitoring of student activities.</p>
      </div>
      
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard title="Total Students" value={stats.totalStudents} icon={Users} color="bg-blue-500" delay={0.1} />
        <StatCard title="Total Sessions" value={stats.totalSessions} icon={Code} color="bg-emerald-500" delay={0.2} />
      </div>

      {/* Recent Activity Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-slate-800/40 backdrop-blur-md border border-slate-700 rounded-2xl overflow-hidden shadow-xl"
      >
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">Recent Coding Sessions</h2>
        </div>
        
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading live data...</div>
        ) : sessions.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No active sessions found.</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-900/50 text-slate-400 text-sm uppercase font-medium">
              <tr>
                <th className="p-4 pl-6">User</th>
                <th className="p-4">Skill Level</th>
                <th className="p-4">Language</th>
                <th className="p-4 text-right pr-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sessions.map((session) => (
                <tr 
                  key={session.id} 
                  onClick={() => navigate(`/admin/session/${session.id}`)}
                  className="hover:bg-slate-700/30 transition cursor-pointer group"
                >
                  <td className="p-4 pl-6 font-medium text-slate-200">{session.email}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      session.stats?.skillLevel === 'Advanced' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      session.stats?.skillLevel === 'Beginner' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                      'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {session.stats?.skillLevel || 'N/A'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 capitalize">{session.language}</td>
                  <td className="p-4 text-right pr-6">
                    <ChevronRight size={18} className="ml-auto text-slate-600 group-hover:text-blue-400 transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
};

export default AdminDashboard;