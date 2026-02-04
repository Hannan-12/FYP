import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { motion } from "framer-motion";
import {
  User,
  Trophy,
  Zap,
  Target,
  Award,
  TrendingUp,
  Code2,
  ChevronLeft,
  Star,
  Flame
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Progress = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Calculate level from XP (100 XP per level)
  const calculateLevel = (xp) => {
    return Math.floor(xp / 100) + 1;
  };

  // Calculate XP needed for next level
  const xpForNextLevel = (xp) => {
    const currentLevel = calculateLevel(xp);
    const nextLevelXP = currentLevel * 100;
    return nextLevelXP - xp;
  };

  // Calculate progress percentage to next level
  const levelProgress = (xp) => {
    const currentLevel = calculateLevel(xp);
    const prevLevelXP = (currentLevel - 1) * 100;
    const nextLevelXP = currentLevel * 100;
    return ((xp - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100;
  };

  // Load user profile and stats
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        // Get or create user profile
        const profileRef = doc(db, "userProfiles", user.uid);
        const profileSnap = await getDoc(profileRef);

        if (!profileSnap.exists()) {
          // Create default profile
          const defaultProfile = {
            userId: user.uid,
            email: user.email,
            totalXP: 0,
            questsCompleted: 0,
            streak: 0,
            badges: [],
            createdAt: new Date()
          };
          await setDoc(profileRef, defaultProfile);
          setProfile(defaultProfile);
        } else {
          setProfile(profileSnap.data());
        }

        // Calculate stats from sessions
        const sessionsQuery = query(
          collection(db, "sessions"),
          where("userId", "==", user.uid)
        );
        const sessionsSnap = await getDocs(sessionsQuery);

        const skillCounts = { Beginner: 0, Intermediate: 0, Advanced: 0 };
        let totalSessions = 0;
        let avgAIProb = 0;
        let avgConfidence = 0;

        sessionsSnap.forEach(doc => {
          const data = doc.data();
          totalSessions++;

          const skillLevel = data.stats?.skillLevel;
          if (skillLevel && skillCounts.hasOwnProperty(skillLevel)) {
            skillCounts[skillLevel]++;
          }

          avgAIProb += data.stats?.aiProbability || 0;
          avgConfidence += data.stats?.confidence || 0;
        });

        setStats({
          totalSessions,
          skillDistribution: skillCounts,
          avgAIProb: totalSessions > 0 ? avgAIProb / totalSessions : 0,
          avgConfidence: totalSessions > 0 ? avgConfidence / totalSessions : 0,
          authenticity: totalSessions > 0 ? 100 - (avgAIProb / totalSessions) : 100
        });

      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!profile) return null;

  const level = calculateLevel(profile.totalXP);
  const xpNeeded = xpForNextLevel(profile.totalXP);
  const progress = levelProgress(profile.totalXP);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-8">
      <button
        onClick={() => navigate("/user/dashboard")}
        className="text-slate-400 hover:text-white flex items-center gap-2 transition"
      >
        <ChevronLeft size={20} /> Back to Dashboard
      </button>

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>

        <div className="relative z-10 flex items-center gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-full p-6 border-4 border-white/20">
            <User className="text-white" size={64} />
          </div>

          <div className="flex-1">
            <h1 className="text-4xl font-bold text-white mb-2">{user.email.split('@')[0]}</h1>
            <p className="text-indigo-100 mb-4">{user.email}</p>

            {/* Level Badge */}
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/30">
                <div className="flex items-center gap-2">
                  <Star className="text-yellow-300" fill="currentColor" size={24} />
                  <span className="text-2xl font-bold text-white">Level {level}</span>
                </div>
              </div>

              {profile.streak > 0 && (
                <div className="bg-orange-500/30 backdrop-blur-md px-4 py-3 rounded-full border border-orange-400/30">
                  <div className="flex items-center gap-2">
                    <Flame className="text-orange-400" fill="currentColor" size={20} />
                    <span className="text-white font-bold">{profile.streak} day streak</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Total XP Display */}
          <div className="text-right">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl px-8 py-4 border border-white/20">
              <p className="text-indigo-100 text-sm mb-1">Total XP</p>
              <p className="text-4xl font-bold text-white">{profile.totalXP}</p>
            </div>
          </div>
        </div>

        {/* Level Progress Bar */}
        <div className="relative z-10 mt-6">
          <div className="flex justify-between text-white text-sm mb-2">
            <span>Progress to Level {level + 1}</span>
            <span>{xpNeeded} XP needed</span>
          </div>
          <div className="bg-white/20 rounded-full h-4 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="bg-gradient-to-r from-yellow-400 to-yellow-300 h-full rounded-full shadow-lg"
            />
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-500/20 p-3 rounded-xl">
              <Target className="text-indigo-400" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-white">Quests Completed</h3>
          </div>
          <p className="text-4xl font-bold text-indigo-400">{profile.questsCompleted}</p>
          <p className="text-slate-400 text-sm mt-2">Keep solving to level up!</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-500/20 p-3 rounded-xl">
              <TrendingUp className="text-green-400" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-white">Authenticity</h3>
          </div>
          <p className="text-4xl font-bold text-green-400">
            {stats ? stats.authenticity.toFixed(1) : 0}%
          </p>
          <p className="text-slate-400 text-sm mt-2">Keep writing code yourself!</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-500/20 p-3 rounded-xl">
              <Code2 className="text-purple-400" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-white">Total Sessions</h3>
          </div>
          <p className="text-4xl font-bold text-purple-400">
            {stats ? stats.totalSessions : 0}
          </p>
          <p className="text-slate-400 text-sm mt-2">Code submissions tracked</p>
        </motion.div>
      </div>

      {/* Badges Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-slate-800 border border-slate-700 rounded-2xl p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <Award className="text-yellow-400" size={28} />
          <h2 className="text-2xl font-bold text-white">Achievements & Badges</h2>
        </div>

        {profile.badges && profile.badges.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {profile.badges.map((badge, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-4 text-center"
              >
                <Trophy className="text-yellow-400 mx-auto mb-2" size={32} />
                <p className="text-white font-semibold">{badge.name}</p>
                <p className="text-slate-400 text-xs mt-1">{badge.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Trophy className="text-slate-600 mx-auto mb-4" size={64} />
            <p className="text-slate-400 text-lg">No badges earned yet</p>
            <p className="text-slate-500 text-sm mt-2">Complete quests to earn your first badge!</p>
          </div>
        )}
      </motion.div>

      {/* Skill Distribution */}
      {stats && stats.totalSessions > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <Zap className="text-indigo-400" size={28} />
            <h2 className="text-2xl font-bold text-white">Skill Distribution</h2>
          </div>

          <div className="space-y-4">
            {Object.entries(stats.skillDistribution).map(([skill, count]) => {
              const percentage = (count / stats.totalSessions) * 100;
              return (
                <div key={skill}>
                  <div className="flex justify-between text-sm text-slate-300 mb-2">
                    <span>{skill}</span>
                    <span>{count} sessions ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="bg-slate-700 rounded-full h-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className={`h-full rounded-full ${
                        skill === "Beginner" ? "bg-green-500" :
                        skill === "Intermediate" ? "bg-blue-500" :
                        "bg-purple-500"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Progress;
