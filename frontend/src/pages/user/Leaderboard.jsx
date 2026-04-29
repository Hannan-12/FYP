import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { collection, getDocs } from "firebase/firestore";
import { motion } from "framer-motion";
import { Trophy, Shield, Zap, Medal, Crown, Star } from "lucide-react";

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
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const snap = await getDocs(collection(db, "userProfiles"));
        setProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Leaderboard fetch failed:", e);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, []);

  const ranked = useMemo(() => {
    return profiles
      .map(p => {
        const authenticity = 100 - (p.avgAIScore ?? 0);
        // Combined score: XP weighted by authenticity factor
        const combinedScore = (p.totalXP || 0) * (authenticity / 100);
        return { ...p, authenticity, combinedScore };
      })
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .map((p, i) => ({ ...p, rank: i + 1 }));
  }, [profiles]);

  const myRank = ranked.find(p => p.userId === user?.uid || p.id === user?.uid);
  const myIndex = myRank ? myRank.rank : null;

  const getDisplayName = (p) => {
    const email = p.email || "";
    const name = p.name || email.split("@")[0] || "Anonymous";
    return name.length > 20 ? name.slice(0, 20) + "…" : name;
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Trophy className="text-yellow-400" size={32} /> Leaderboard
        </h1>
        <p className="text-slate-400 mt-2 text-sm">
          Ranked by XP × Authenticity — the more you code yourself, the higher you climb.
        </p>
      </div>

      {/* Your rank card */}
      {myRank && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-600/20 border border-indigo-500/40 rounded-2xl p-5 flex items-center gap-6"
        >
          <div className="text-center min-w-[48px]">
            {getRankIcon(myRank.rank)}
          </div>
          <div className="flex-1">
            <p className="text-xs text-indigo-300 uppercase tracking-wider mb-0.5">Your Position</p>
            <p className="text-white font-bold text-lg">{getDisplayName(myRank)}</p>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-xs text-slate-400">XP</p>
              <p className="text-white font-bold">{myRank.totalXP || 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Authenticity</p>
              <p className={`font-bold ${getAuthColor(myRank.authenticity)}`}>{myRank.authenticity.toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Score</p>
              <p className="text-indigo-300 font-bold">{myRank.combinedScore.toFixed(0)}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Score formula explanation */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-700 px-3 py-2 rounded-lg">
          <Zap size={13} className="text-yellow-400" /> XP from completed quests
        </div>
        <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-700 px-3 py-2 rounded-lg">
          <Shield size={13} className="text-emerald-400" /> Authenticity = 100% − avg AI score
        </div>
        <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-700 px-3 py-2 rounded-lg">
          <Star size={13} className="text-indigo-400" /> Final score = XP × (Authenticity / 100)
        </div>
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
                <th className="p-4 text-right">Quests</th>
                <th className="p-4 text-right">Badges</th>
                <th className="p-4 text-right pr-6">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500">Loading leaderboard...</td>
                </tr>
              ) : ranked.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500">No data yet — complete quests to appear here!</td>
                </tr>
              ) : (
                ranked.map((p, i) => {
                  const isMe = p.userId === user?.uid || p.id === user?.uid;
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
                          {p.authenticity.toFixed(0)}%
                        </span>
                      </td>
                      <td className="p-4 text-right text-slate-300 tabular-nums">
                        {p.questsCompleted || 0}
                      </td>
                      <td className="p-4 text-right text-slate-300 tabular-nums">
                        {(p.badges || []).length}
                      </td>
                      <td className="p-4 pr-6 text-right font-bold text-indigo-300 tabular-nums">
                        {p.combinedScore.toFixed(0)}
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
