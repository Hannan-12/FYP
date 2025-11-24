import { useEffect, useState } from "react";
import { db } from "../../firebase/config";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from "recharts";

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [skillData, setSkillData] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, "sessions"), orderBy("timestamp", "asc"));
        const snapshot = await getDocs(q);
        const sessions = snapshot.docs.map(doc => doc.data());

        // --- 1. Process Data for Pie Chart (Skill Level) ---
        const skills = { Beginner: 0, Intermediate: 0, Advanced: 0 };
        
        sessions.forEach(s => {
          // SAFETY CHECK: Use ?. to avoid crashes if 'stats' is missing
          const level = s.stats?.skillLevel || "Beginner"; 
          if (skills[level] !== undefined) skills[level]++;
        });

        const pieData = [
          { name: "Beginner", value: skills.Beginner },
          { name: "Intermediate", value: skills.Intermediate },
          { name: "Advanced", value: skills.Advanced }
        ];

        // --- 2. Process Data for Bar Chart (Sessions per Date) ---
        const timeline = {};
        sessions.forEach(s => {
          if (s.timestamp) {
            const date = new Date(s.timestamp.seconds * 1000).toLocaleDateString();
            timeline[date] = (timeline[date] || 0) + 1;
          }
        });

        const barData = Object.keys(timeline).map(date => ({
          date: date,
          sessions: timeline[date]
        }));

        setSkillData(pieData);
        setActivityData(barData);
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError("Failed to load analytics data. Check console for details.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const COLORS = ["#9CA3AF", "#3B82F6", "#10B981"]; // Gray, Blue, Green

  if (loading) return <div className="p-10 text-center text-gray-500">Loading Analytics...</div>;
  if (error) return <div className="p-10 text-center text-red-500">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">System Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Chart 1: Skill Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-700 mb-4">Student Skill Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={skillData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {skillData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Daily Activity */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-700 mb-4">Daily Coding Sessions</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="sessions" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Summary Box */}
      <div className="mt-8 bg-indigo-900 text-white p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-bold">AI Insight</h3>
        <p className="mt-2 text-indigo-200">
          Total Sessions Analyzed: <span className="font-bold text-white">{skillData.reduce((a, b) => a + b.value, 0)}</span>.
          Most students are performing at the <span className="font-bold text-white">
            {skillData.length > 0 ? skillData.reduce((prev, current) => (prev.value > current.value) ? prev : current).name : "N/A"}
          </span> level.
        </p>
      </div>
    </div>
  );
};

export default Analytics;