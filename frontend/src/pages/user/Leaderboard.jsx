import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { Trophy, Shield, Zap, Medal, Crown, Star, RefreshCw } from "lucide-react";

const EMA_ALPHA = 0.25; // weight of each new session (recent = more impact)

// Compute EMA authenticity from sessions sorted oldest → newest
const computeEMA = (sessions) => {
  const sorted = [...sessions]
    .filter(s => s.stats?.aiProbability != null)
    .sort((a, b) => {
      const tA = a.timestamp?.seconds || a.startTime?.seconds || 0;
      const tB = b.timestamp?.seconds || b.startTime?.seconds || 0;
      return tA - tB;
    });

  if (sorted.length === 0) return null;

  // Start with first session's AI score
  let ema = sorted[0].stats.aiProbability;
  for (let i = 1; i < sorted.length; i++) {
    const score = sorted[i].stats.aiProbability;
    ema = ema * (1 - EMA_ALPHA) + score * EMA_ALPHA;
  }
  return parseFloat(ema.toFixed(2));
};

const getRankIcon = (rank) => {
  if (rank === 1) return <Crown size={20} className="text-yellow-400" fill="currentColor" />;
  if (rank === 2) return <Medal size={20} className="text-slate-300" fill="currentColor" />;
  if (rank === 3) return <Medal size={20} className="text-amber-600" fill="currentColor" />;
  return <span className="text-slate-500 font-bold text-sm w-5 text-center">#{rank}</span>;
};

const getAuthColor = (pct) => {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 50) return "text-yellow-400";
  return "text-rose-400";
};

const getAuthBg = (pct) => {
  if (pct >= 80) return "bg-emerald-500/10 border-emerald-500/20";
  if (pct >= 50) return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-rose-500/10 border-rose-500/20";
};

const SkillBadge = ({ level }) => {
  const styles = {
    Advanced:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Intermediate: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Beginner:     "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${styles[level] || styles.Beginner}`}>
      {level || "Beginner"}
    </span>
  );
};

const Leaderboard = () => {
  const { user } = useAuth();
  const [ranked, setRanked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      // Fetch all profiles, all sessions, and all users in parallel
      const [profilesSnap, sessionsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "userProfiles")),
        getDocs(collection(db, "sessions")),
        getDocs(collection(db, "users")),
      ]);

      // Build user info map from users collection (email, name)
      const userInfoMap = {};
      usersSnap.docs.forEach(d => {
        userInfoMap[d.id] = d.data();
      });

      // Group sessions by userId
      const sessionsByUser = {};
      sessionsSnap.docs.forEach(d => {
        const s = d.data();
        const uid = s.userId;
        if (!uid) return;
        if (!sessionsByUser[uid]) sessionsByUser[uid] = [];
        sessionsByUser[uid].push(s);
      });

      // Build a map of existing userProfiles by uid
      const profileMap = {};
      profilesSnap.docs.forEach(d => {
        const p = { id: d.id, ...d.data() };
        const uid = p.userId || p.id;
        profileMap[uid] = p;
      });

      // Union of all uids: from userProfiles + from sessions
      const allUids = new Set([
        ...Object.keys(profileMap),
        ...Object.keys(sessionsByUser),
      ]);

      // Build ranked list
      const rows = [];
      const updates = [];

      allUids.forEach(uid => {
        const p = profileMap[uid] || {};
        const userInfo = userInfoMap[uid] || {};
        const userSessions = sessionsByUser[uid] || [];

        // Compute fresh EMA from all sessions
        const emaAI = computeEMA(userSessions);
        const avgAIScore = emaAI ?? p.avgAIScore ?? 0;
        const authenticity = parseFloat((100 - avgAIScore).toFixed(1));

        // Most recent skill level from sessions
        const withSkill = [...userSessions]
          .filter(s => s.stats?.skillLevel)
          .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        const skillLevel = withSkill[0]?.stats?.skillLevel || p.skillLevel || "Beginner";

        const combinedScore = parseFloat(((p.totalXP || 0) * (authenticity / 100)).toFixed(1));

        const name = p.name || userInfo.name || userInfo.email?.split("@")[0] || "";
        const email = p.email || userInfo.email || "";

        rows.push({
          ...p,
          uid,
          name,
          email,
          avgAIScore,
          authenticity,
          skillLevel,
          combinedScore,
          sessionCount: userSessions.length,
        });

        // Queue Firestore update if EMA changed meaningfully
        if (emaAI !== null && p.id && Math.abs(avgAIScore - (p.avgAIScore ?? -1)) > 0.01) {
          updates.push({ ref: doc(db, "userProfiles", p.id), avgAIScore, skillLevel });
        }
      });

      // Sort by combined score descending
      rows.sort((a, b) => b.combinedScore - a.combinedScore);
      setRanked(rows.map((r, i) => ({ ...r, rank: i + 1 })));

      // Write updated avgAIScore back to Firestore for all users (background)
      if (updates.length > 0) {
        setUpdating(true);
        await Promise.all(updates.map(u => updateDoc(u.ref, { avgAIScore: u.avgAIScore, skillLevel: u.skillLevel })));
        setUpdating(false);
      }
    } catch (e) {
      console.error("Leaderboard load failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLeaderboard(); }, []);

  const myRank = useMemo(() => ranked.find(p => p.uid === user?.uid || p.id === user?.uid), [ranked, user]);

  const getDisplayName = (p) => {
    const name = p.name || p.email?.split("@")[0] || "Anonymous";
    return name.length > 22 ? name.slice(0, 22) + "…" : name;
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Trophy className="text-yellow-400" size={32} /> Leaderboard
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Ranked by XP × Authenticity — scores update from all sessions (quests + VS Code).
          </p>
        </div>
        <button
          onClick={loadLeaderboard}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white rounded-xl text-sm transition-all"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Your rank card */}
      {myRank && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-600/20 border border-indigo-500/40 rounded-2xl p-5 flex items-center gap-6"
        >
          <div className="flex items-center justify-center min-w-[40px]">
            {getRankIcon(myRank.rank)}
          </div>
          <div className="flex-1">
            <p className="text-xs text-indigo-300 uppercase tracking-wider mb-0.5">Your Position</p>
            <p className="text-white font-bold text-lg">{getDisplayName(myRank)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{myRank.sessionCount} sessions tracked</p>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-xs text-slate-400">XP</p>
              <p className="text-white font-bold">{myRank.totalXP || 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Authenticity</p>
              <p className={`font-bold ${getAuthColor(myRank.authenticity)}`}>{myRank.authenticity}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Score</p>
              <p className="text-indigo-300 font-bold">{myRank.combinedScore}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Score formula explanation */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-700 px-3 py-2 rounded-lg">
          <Zap size={13} className="text-yellow-400" /> XP from completed quests
        </div>
        <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-700 px-3 py-2 rounded-lg">
          <Shield size={13} className="text-emerald-400" /> Authenticity via weighted recent sessions (EMA)
        </div>
        <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-700 px-3 py-2 rounded-lg">
          <Star size={13} className="text-indigo-400" /> Score = XP × (Authenticity / 100)
        </div>
        {updating && (
          <div className="flex items-center gap-2 bg-slate-800/40 border border-indigo-500/30 px-3 py-2 rounded-lg text-indigo-400">
            <RefreshCw size={13} className="animate-spin" /> Syncing scores...
          </div>
        )}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-slate-800/40 backdrop-blur-md border border-slate-700 rounded-2xl overflow-hidden shadow-xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-medium">
              <tr>
                <th className="p-4 pl-6 w-14">Rank</th>
                <th className="p-4">Student</th>
                <th className="p-4">Skill</th>
                <th className="p-4 text-right">XP</th>
                <th className="p-4 text-right">Authenticity</th>
                <th className="p-4 text-right">Sessions</th>
                <th className="p-4 text-right">Quests</th>
                <th className="p-4 text-right">Badges</th>
                <th className="p-4 text-right pr-6">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-3">
                      <RefreshCw size={18} className="animate-spin text-indigo-400" />
                      Computing scores from all sessions...
                    </div>
                  </td>
                </tr>
              ) : ranked.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
                    No data yet — complete quests to appear here!
                  </td>
                </tr>
              ) : (
                ranked.map((p, i) => {
                  const isMe = p.uid === user?.uid || p.id === user?.uid;
                  return (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`transition ${isMe ? "bg-indigo-500/10 border-l-2 border-indigo-500" : "hover:bg-slate-700/20"}`}
                    >
                      <td className="p-4 pl-6">
                        <div className="flex items-center justify-center w-8">
                          {getRankIcon(p.rank)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm shrink-0">
                            {getDisplayName(p)[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className={`font-semibold ${isMe ? "text-indigo-300" : "text-slate-200"}`}>
                              {getDisplayName(p)}
                              {isMe && <span className="ml-2 text-xs text-indigo-400 font-normal">(you)</span>}
                            </p>
                            <p className="text-xs text-slate-600">{p.sessionCount} sessions</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <SkillBadge level={p.skillLevel} />
                      </td>
                      <td className="p-4 text-right font-bold text-yellow-400 tabular-nums">
                        {p.totalXP || 0}
                      </td>
                      <td className="p-4 text-right tabular-nums">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getAuthBg(p.authenticity)} ${getAuthColor(p.authenticity)}`}>
                          {p.authenticity}%
                        </span>
                      </td>
                      <td className="p-4 text-right text-slate-300 tabular-nums">
                        {p.sessionCount}
                      </td>
                      <td className="p-4 text-right text-slate-300 tabular-nums">
                        {p.questsCompleted || 0}
                      </td>
                      <td className="p-4 text-right text-slate-300 tabular-nums">
                        {(p.badges || []).length}
                      </td>
                      <td className="p-4 pr-6 text-right font-bold text-indigo-300 tabular-nums">
                        {p.combinedScore}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default Leaderboard;
