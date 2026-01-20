import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Brain, Trophy, Zap, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const Quests = () => {
  const [quest, setQuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // In production, this would fetch the real detected skill from the user profile
    const fetchQuest = async () => {
      try {
        const response = await fetch(`http://localhost:8000/get-quest/Beginner`);
        const data = await response.json();
        setQuest(data);
      } catch (error) {
        console.error("Failed to fetch quest:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuest();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <button 
        onClick={() => navigate("/user/dashboard")}
        className="text-slate-400 hover:text-white flex items-center gap-2 transition"
      >
        <ChevronLeft size={20} /> Back to Dashboard
      </button>

      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-white flex items-center justify-center gap-3">
          <Brain className="text-indigo-400" size={40} /> Skill-Up Playground
        </h1>
        <p className="text-slate-400 mt-2">Challenge yourself to level up your coding skills.</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">Generating your next challenge...</div>
      ) : quest && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-800 border-2 border-indigo-500/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="flex justify-between items-center mb-8">
            <span className="bg-indigo-500/20 text-indigo-400 px-4 py-1 rounded-full text-sm font-bold border border-indigo-500/30 uppercase tracking-widest">
              Current Quest: {quest.title}
            </span>
            <div className="flex items-center gap-2 text-yellow-400 bg-yellow-400/10 px-4 py-1 rounded-full border border-yellow-400/20">
              <Trophy size={18} />
              <span className="font-bold">{quest.xp} XP</span>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl text-indigo-300 font-semibold uppercase tracking-tight">Mission Objective</h2>
            <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
              <p className="text-slate-200 text-lg leading-relaxed font-mono">
                {quest.task}
              </p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all">
              Skip Quest
            </button>
            <button className="py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all">
              <Zap size={20} fill="currentColor" /> Submit Solution
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Quests;