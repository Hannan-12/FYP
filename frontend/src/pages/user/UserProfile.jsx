import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { motion } from "framer-motion";
import { User, Mail, Shield, Calendar, Save, Loader2, Star, Trophy, Code, CheckCircle, TrendingUp, Flame, Award } from "lucide-react";

const UserProfile = () => {
  const { user } = useAuth();
  const [userData, setUserData]   = useState(null);
  const [profile, setProfile]     = useState(null);
  const [sessionStats, setSessionStats] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [name, setName]           = useState("");
  const [message, setMessage]     = useState("");

  const joinedDate = () => {
    if (userData?.createdAt?.seconds)
      return new Date(userData.createdAt.seconds * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    if (user?.metadata?.creationTime)
      return new Date(user.metadata.creationTime).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    return "N/A";
  };

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      try {
        // User doc (name, role)
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const d = userSnap.data();
          setUserData(d);
          setName(d.name || user.displayName || "");
        }

        // userProfiles doc (XP, badges, streak, quests)
        const profSnap = await getDoc(doc(db, "userProfiles", user.uid));
        if (profSnap.exists()) setProfile(profSnap.data());

        // Sessions stats
        const snap = await getDocs(query(collection(db, "sessions"), where("userId", "==", user.uid)));
        const sessions = snap.docs.map(d => d.data());
        const withAI = sessions.filter(s => s.stats?.aiProbability != null);
        const authenticity = withAI.length > 0
          ? Math.round(100 - withAI.reduce((a, s) => a + s.stats.aiProbability, 0) / withAI.length)
          : 100;
        const withSkill = sessions.filter(s => s.stats?.skillLevel)
          .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        const langSet = new Set();
        sessions.forEach(s => {
          (s.languagesUsed || []).forEach(l => langSet.add(l));
          if (s.language) langSet.add(s.language);
        });
        setSessionStats({
          total: sessions.length,
          authenticity,
          skillLevel: withSkill[0]?.stats?.skillLevel || "N/A",
          languages: langSet.size,
        });
      } catch (e) {
        console.error("Profile load failed:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await updateDoc(doc(db, "users", user.uid), { name });
      // Also update userProfiles so leaderboard shows correct name
      const profSnap = await getDoc(doc(db, "userProfiles", user.uid));
      if (profSnap.exists()) await updateDoc(doc(db, "userProfiles", user.uid), { name });
      setUserData(prev => ({ ...prev, name }));
      setMessage("Profile updated successfully!");
    } catch (e) {
      console.error("Update failed:", e);
      setMessage("Failed to update profile.");
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading profile...</div>;

  const level = profile ? Math.floor((profile.totalXP || 0) / 100) + 1 : 1;
  const levelProgress = profile ? (profile.totalXP || 0) % 100 : 0;
  const initials = (name || user?.email || "U")[0].toUpperCase();

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-white">My Profile</h1>
        <p className="text-slate-400 mt-2">Manage your account settings and view your stats.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* ── Left: Profile card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Avatar + name */}
          <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-6 text-center shadow-xl">
            <div className="w-28 h-28 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-2xl shadow-indigo-500/30">
              {initials}
            </div>
            <h2 className="text-xl font-bold text-white">{name || "Student"}</h2>
            <p className="text-slate-400 text-sm mt-1 break-all">{user?.email}</p>
            <div className="mt-4 flex justify-center">
              <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold px-4 py-1.5 rounded-full capitalize">
                {userData?.role || "Student"}
              </span>
            </div>
          </div>

          {/* XP / Level */}
          {profile && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-yellow-400" fill="currentColor" />
                  <span className="text-white font-bold text-sm">Level {level}</span>
                </div>
                <span className="text-yellow-400 text-sm font-bold">{profile.totalXP || 0} XP</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${levelProgress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">{100 - levelProgress} XP to Level {level + 1}</p>
            </div>
          )}

          {/* Quick stats */}
          {sessionStats && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-3">
              <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">Quick Stats</h3>
              {[
                { icon: Code,         color: "text-blue-400",    label: "Total Sessions",    value: sessionStats.total },
                { icon: CheckCircle,  color: "text-emerald-400", label: "Authenticity",      value: `${sessionStats.authenticity}%` },
                { icon: TrendingUp,   color: "text-purple-400",  label: "Skill Level",       value: sessionStats.skillLevel },
                { icon: Trophy,       color: "text-yellow-400",  label: "Quests Completed",  value: profile?.questsCompleted || 0 },
                { icon: Flame,        color: "text-orange-400",  label: "Day Streak",        value: profile?.streak || 0 },
              ].map(({ icon: Icon, color, label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={15} className={color} />
                    <span className="text-slate-400 text-sm">{label}</span>
                  </div>
                  <span className="text-white text-sm font-bold">{value}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Right: Edit form + Badges ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Personal Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-8 shadow-xl"
          >
            <h3 className="text-lg font-bold text-white mb-6">Personal Information</h3>
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full pl-9 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3.5 text-slate-500" />
                    <input
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="w-full pl-9 pr-4 py-3 bg-slate-900/30 border border-slate-700 rounded-xl text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Account Role</label>
                  <div className="relative">
                    <Shield size={16} className="absolute left-3 top-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={userData?.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : "Student"}
                      disabled
                      className="w-full pl-9 pr-4 py-3 bg-slate-900/30 border border-slate-700 rounded-xl text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Joined Date</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={joinedDate()}
                      disabled
                      className="w-full pl-9 pr-4 py-3 bg-slate-900/30 border border-slate-700 rounded-xl text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700 flex items-center justify-between">
                {message && (
                  <span className={`text-sm ${message.includes("success") ? "text-emerald-400" : "text-rose-400"}`}>
                    {message}
                  </span>
                )}
                <div className="ml-auto">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </motion.div>

          {/* Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-8 shadow-xl"
          >
            <div className="flex items-center gap-2 mb-6">
              <Award size={20} className="text-yellow-400" />
              <h3 className="text-lg font-bold text-white">Achievements & Badges</h3>
              {(profile?.badges || []).length > 0 && (
                <span className="ml-auto text-xs text-slate-500">{profile.badges.length} earned</span>
              )}
            </div>
            {(profile?.badges || []).length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {profile.badges.map((badge, i) => (
                  <div key={i} className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                    <span className="text-2xl shrink-0">{badge.icon || "🏆"}</span>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-bold truncate">{badge.name}</p>
                      <p className="text-slate-400 text-xs truncate">{badge.description}</p>
                      {badge.earnedAt && (
                        <p className="text-slate-600 text-[10px] mt-0.5">{new Date(badge.earnedAt).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy size={48} className="mx-auto text-slate-600 mb-3" />
                <p className="text-slate-400 font-medium">No badges earned yet</p>
                <p className="text-slate-500 text-sm mt-1">Complete quests to unlock achievements</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
