import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // <--- Added for navigation
import { db } from "../../firebase/config";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { Users, Code, Brain, AlertTriangle, Clock } from "lucide-react";

// 1. Reusable Card Component
const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
    <div>
      <p className="text-gray-500 text-sm font-medium">{title}</p>
      <h3 className="text-3xl font-bold text-gray-800 mt-1">{value}</h3>
    </div>
    <div className={`p-4 rounded-full ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
  </div>
);

const AdminDashboard = () => {
  const navigate = useNavigate(); // <--- Initialize navigation
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalSessions: 0,
    aiDetections: 0,
    criticalFlags: 0
  });

  // 2. Real-time Listener
  useEffect(() => {
    const q = query(
      collection(db, "sessions"), 
      orderBy("timestamp", "desc"), 
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSessions(sessionData);

      // Calculate Stats on the fly
      const total = sessionData.length;
      const aiCount = sessionData.filter(s => s.stats.aiProbability > 50).length;
      const flags = sessionData.filter(s => s.stats.aiProbability > 80).length;

      setStats({
        totalStudents: 12, // Placeholder until we link Users collection count
        totalSessions: total,
        aiDetections: aiCount,
        criticalFlags: flags
      });
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Live Overview</h1>
      
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Students" value={stats.totalStudents} icon={Users} color="bg-blue-500" />
        <StatCard title="Total Sessions" value={stats.totalSessions} icon={Code} color="bg-green-500" />
        <StatCard title="High AI Prob > 50%" value={stats.aiDetections} icon={Brain} color="bg-purple-500" />
        <StatCard title="Critical > 80%" value={stats.criticalFlags} icon={AlertTriangle} color="bg-red-500" />
      </div>

      {/* Recent Activity List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Recent Coding Sessions</h2>
        </div>
        
        {loading ? (
          <div className="p-10 text-center text-gray-500">Connecting to Firestore...</div>
        ) : sessions.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No sessions found. Run the Python simulator!</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Skill Level</th>
                <th className="p-4">AI Probability</th>
                <th className="p-4">Language</th>
                <th className="p-4">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map((session) => (
                <tr 
                  key={session.id} 
                  onClick={() => navigate(`/admin/session/${session.id}`)} // <--- CLICK HANDLER ADDED
                  className="hover:bg-blue-50 transition cursor-pointer"   // <--- VISUAL CUES ADDED
                >
                  <td className="p-4 font-medium text-gray-800">{session.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold 
                      ${session.stats.skillLevel === 'Advanced' ? 'bg-green-100 text-green-700' : 
                        session.stats.skillLevel === 'Beginner' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                      {session.stats.skillLevel}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div 
                          className={`h-2 rounded-full ${session.stats.aiProbability > 50 ? 'bg-red-500' : 'bg-green-500'}`} 
                          style={{ width: `${Math.min(session.stats.aiProbability, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">{session.stats.aiProbability.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 capitalize">{session.language}</td>
                  <td className="p-4 text-gray-400 text-sm flex items-center">
                    <Clock size={14} className="mr-1"/>
                    {session.timestamp ? new Date(session.timestamp.seconds * 1000).toLocaleTimeString() : "Just now"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;