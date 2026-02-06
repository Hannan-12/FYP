import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { motion } from "framer-motion";
import { ChevronLeft, Clock, Code2, Calendar, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MySessions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user?.uid) return;

      try {
        // Try with orderBy first, fall back to without if index doesn't exist
        let sessionsData = [];
        try {
          const sessionsQuery = query(
            collection(db, "sessions"),
            where("userId", "==", user.uid),
            orderBy("timestamp", "desc")
          );
          const snapshot = await getDocs(sessionsQuery);
          sessionsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (indexError) {
          console.warn("Index error, fetching without orderBy:", indexError);
          // Fallback: fetch without ordering (if composite index doesn't exist)
          const simpleQuery = query(
            collection(db, "sessions"),
            where("userId", "==", user.uid)
          );
          const snapshot = await getDocs(simpleQuery);
          sessionsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          // Sort manually on client side
          sessionsData.sort((a, b) => {
            const timeA = a.timestamp?.seconds || 0;
            const timeB = b.timestamp?.seconds || 0;
            return timeB - timeA;
          });
        }

        console.log("Fetched sessions:", sessionsData.length);
        setSessions(sessionsData);
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-8">
      <button
        onClick={() => navigate("/user/dashboard")}
        className="text-slate-400 hover:text-white flex items-center gap-2 transition"
      >
        <ChevronLeft size={20} /> Back to Dashboard
      </button>

      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Clock className="text-indigo-400" size={32} />
          My Sessions
        </h1>
        <p className="text-slate-400 mt-2">View your coding session history and progress.</p>
      </div>

      {sessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center"
        >
          <Code2 size={64} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-xl font-semibold text-slate-300 mb-2">No sessions yet</h3>
          <p className="text-slate-500 mb-6">Complete quests to start tracking your progress.</p>
          <button
            onClick={() => navigate("/user/quests")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Start a Quest
          </button>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-slate-800 border rounded-2xl p-6 hover:border-indigo-500/30 transition-all ${
                session.stats?.passed === false ? 'border-red-500/30' :
                session.stats?.passed === true ? 'border-green-500/30' : 'border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    session.stats?.passed === false ? 'bg-red-500/20' :
                    session.stats?.passed === true ? 'bg-green-500/20' : 'bg-indigo-500/20'
                  }`}>
                    {session.stats?.passed === false ? (
                      <XCircle className="text-red-400" size={24} />
                    ) : session.stats?.passed === true ? (
                      <CheckCircle className="text-green-400" size={24} />
                    ) : (
                      <Code2 className="text-indigo-400" size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {session.fileName?.replace('.py', '') || session.language || "Unknown"} Session
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {session.timestamp
                          ? new Date(session.timestamp.seconds * 1000).toLocaleDateString()
                          : "Unknown date"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {session.stats?.duration
                          ? `${Math.round(session.stats.duration)}s`
                          : "N/A"}
                      </span>
                      {session.stats?.testsPassed != null && session.stats?.testsTotal != null && (
                        <span className={`flex items-center gap-1 ${
                          session.stats.passed ? 'text-green-400' : 'text-red-400'
                        }`}>
                          Tests: {session.stats.testsPassed}/{session.stats.testsTotal}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Pass/Fail Status */}
                  {session.stats?.passed !== undefined && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Result</p>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        session.stats.passed
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {session.stats.passed ? 'Passed' : 'Failed'}
                      </span>
                    </div>
                  )}

                  <div className="text-right">
                    <p className="text-xs text-slate-500">Skill Level</p>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      session.stats?.skillLevel === 'Advanced'
                        ? 'bg-purple-500/20 text-purple-400'
                        : session.stats?.skillLevel === 'Intermediate'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {session.stats?.skillLevel || "N/A"}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-500">Authenticity</p>
                    <span className={`text-lg font-bold ${
                      (session.stats?.aiProbability || 0) > 50 ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {session.stats?.aiProbability != null
                        ? `${(100 - session.stats.aiProbability).toFixed(0)}%`
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MySessions;
