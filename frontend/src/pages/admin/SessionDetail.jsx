import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Clock, Code, Keyboard, Brain, User } from "lucide-react";

const SessionDetail = () => {
  const { id } = useParams(); // Get the ID from the URL
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const docRef = doc(db, "sessions", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setSession({ id: docSnap.id, ...docSnap.data() });
        } else {
          console.error("No such document!");
        }
      } catch (error) {
        console.error("Error fetching session:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [id]);

  if (loading) return <div className="p-10 text-center">Loading Session Details...</div>;
  if (!session) return <div className="p-10 text-center">Session not found.</div>;

  return (
    <div>
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-600 hover:text-blue-600 mb-6 transition"
      >
        <ArrowLeft size={18} className="mr-2" />
        Back to Dashboard
      </button>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <User className="text-blue-600" />
            {session.email}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Session ID: {session.id}
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm
            ${session.stats.skillLevel === 'Advanced' ? 'bg-green-100 text-green-700' : 
              session.stats.skillLevel === 'Beginner' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
            Skill Level: {session.stats.skillLevel}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock size={20} className="text-orange-600" />
            </div>
            <span className="text-gray-500 font-medium">Time Taken</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{session.stats.duration}s</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Keyboard size={20} className="text-purple-600" />
            </div>
            <span className="text-gray-500 font-medium">Total Keystrokes</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{session.stats.keystrokes}</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <Brain size={20} className="text-red-600" />
            </div>
            <span className="text-gray-500 font-medium">AI Probability</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-gray-800">{session.stats.aiProbability.toFixed(1)}%</p>
            {session.stats.aiProbability > 50 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">High Risk</span>
            )}
          </div>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-2 text-gray-300">
            <Code size={16} />
            <span className="text-sm font-mono">{session.fileName || "script.py"}</span>
          </div>
          <span className="text-xs text-gray-500 uppercase">{session.language}</span>
        </div>
        <div className="p-6 overflow-x-auto">
          <pre className="font-mono text-sm text-green-400 leading-relaxed">
            <code>{session.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SessionDetail;