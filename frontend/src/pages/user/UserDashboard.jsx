import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Code, TrendingUp, Clock, CheckCircle } from "lucide-react";

const UserDashboard = () => {
  const { user } = useAuth(); // Get currently logged in student
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Stats state
  const [stats, setStats] = useState({
    totalSessions: 0,
    avgAccuracy: 0,
    latestSkill: "N/A"
  });

  useEffect(() => {
    if (!user) return;

    // 🔍 FILTER: Only get sessions for THIS user
    // Note: We are using email for now to match the Python simulator
    const q = query(
      collection(db, "sessions"),
      where("email", "==", user.email), 
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSessions(data);

      // Calc simple stats
      if (data.length > 0) {
        const latest = data[0].stats.skillLevel;
        // Mock accuracy calculation based on AI prob (inverse for demo)
        const avgAcc = 100 - (data.reduce((acc, curr) => acc + curr.stats.aiProbability, 0) / data.length);
        
        setStats({
          totalSessions: data.length,
          avgAccuracy: Math.round(avgAcc),
          latestSkill: latest
        });
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Welcome back, Student!</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-indigo-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-500 text-sm">Total Sessions</p>
              <h3 className="text-3xl font-bold">{stats.totalSessions}</h3>
            </div>
            <Code className="text-indigo-500" size={28} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-500 text-sm">Code Authenticity</p>
              <h3 className="text-3xl font-bold">{stats.avgAccuracy}%</h3>
            </div>
            <CheckCircle className="text-green-500" size={28} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-500 text-sm">Current Skill Level</p>
              <h3 className="text-3xl font-bold">{stats.latestSkill}</h3>
            </div>
            <TrendingUp className="text-purple-500" size={28} />
          </div>
        </div>
      </div>

      {/* Personal History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">My Recent Activity</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading your data...</div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">You haven't coded anything yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sessions.map((session) => (
              <div key={session.id} className="p-4 hover:bg-gray-50 flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-800 capitalize">{session.language} Practice</p>
                  <p className="text-sm text-gray-500 flex items-center mt-1">
                    <Clock size={12} className="mr-1"/>
                    {session.timestamp ? new Date(session.timestamp.seconds * 1000).toLocaleString() : "Just now"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                    {session.stats.skillLevel}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    AI Score: {session.stats.aiProbability.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;