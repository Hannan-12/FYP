import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase/config";
import { doc, getDoc, getDocs, collection, query, where, orderBy, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase/config";
import {
  ArrowLeft, Mail, Calendar, Shield, Clock, Code, Keyboard,
  ChevronRight, ToggleLeft, ToggleRight, ShieldCheck, ShieldOff, KeyRound, User
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const formatDuration = (s) => {
  if (!s || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (m === 0) return `${sec}s`;
  if (m < 60) return `${m}m ${sec}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const formatDate = (session) => {
  const ts = session.timestamp || session.startTime || session.createdAt;
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
};

const StudentDetail = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [student, setStudent]     = useState(null);
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);
  const [confirming, setConfirming] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch user doc
        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists()) setStudent({ id: userSnap.id, ...userSnap.data() });

        // Fetch all their sessions
        try {
          const q = query(collection(db, "sessions"), where("userId", "==", uid), orderBy("timestamp", "desc"));
          const snap = await getDocs(q);
          setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch {
          // fallback without orderBy if index missing
          const q2 = query(collection(db, "sessions"), where("userId", "==", uid));
          const snap2 = await getDocs(q2);
          const data = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
          data.sort((a, b) => {
            const tA = (a.timestamp || a.startTime)?.seconds || 0;
            const tB = (b.timestamp || b.startTime)?.seconds || 0;
            return tB - tA;
          });
          setSessions(data);
        }
      } catch (e) {
        console.error("Error loading student:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [uid]);

  const toggleActive = async () => {
    const newVal = student.isActive === false ? true : false;
    await updateDoc(doc(db, "users", uid), { isActive: newVal });
    setStudent(s => ({ ...s, isActive: newVal }));
    showToast(`Account ${newVal ? "enabled" : "disabled"}.`);
    setConfirming(null);
  };

  const changeRole = async () => {
    const newRole = student.role === "admin" ? "student" : "admin";
    await updateDoc(doc(db, "users", uid), { role: newRole });
    setStudent(s => ({ ...s, role: newRole }));
    showToast(`Role changed to ${newRole}.`);
    setConfirming(null);
  };

  const sendReset = async () => {
    await sendPasswordResetEmail(auth, student.email);
    showToast(`Password reset email sent to ${student.email}.`);
    setConfirming(null);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading student...</div>;
  if (!student) return <div className="p-10 text-center text-slate-500">Student not found.</div>;

  const isActive = student.isActive !== false;
  const isAdmin  = student.role === "admin";

  // Derived stats from sessions
  const completed  = sessions.filter(s => s.status === "completed");
  const totalTime  = completed.reduce((acc, s) => acc + (s.activeDuration || (s.totalDuration ? s.totalDuration / 1000 : 0) || s.stats?.duration || 0), 0);
  const avgAI      = completed.length ? Math.round(completed.reduce((acc, s) => acc + (s.stats?.aiProbability || 0), 0) / completed.length) : null;
  const languages  = [...new Set(sessions.flatMap(s => s.languagesUsed || (s.language ? [s.language] : [])))];
  const skillCounts = { Beginner: 0, Intermediate: 0, Advanced: 0 };
  completed.forEach(s => { if (s.stats?.skillLevel) skillCounts[s.stats.skillLevel]++; });
  const topSkill = Object.entries(skillCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium ${
              toast.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-white font-bold text-lg mb-2">Confirm Action</h3>
              <p className="text-slate-400 text-sm mb-6">{confirming.message}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirming(null)} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition text-sm font-medium">Cancel</button>
                <button onClick={confirming.onConfirm} className={`flex-1 py-2 rounded-lg text-white text-sm font-bold transition ${confirming.danger ? "bg-rose-600 hover:bg-rose-500" : "bg-blue-600 hover:bg-blue-500"}`}>Confirm</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="p-2 mt-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-xl shadow-lg shrink-0 ${isAdmin ? "bg-gradient-to-br from-blue-500 to-blue-700" : "bg-gradient-to-br from-indigo-500 to-violet-600"}`}>
              {student.name?.[0]?.toUpperCase() || <User size={24} />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{student.name || "Unknown"}</h1>
              <p className="text-slate-400 flex items-center gap-2 text-sm mt-0.5">
                <Mail size={13} /> {student.email}
                {student.createdAt && <><Calendar size={13} className="ml-2" /> Joined {new Date(student.createdAt.seconds * 1000).toLocaleDateString()}</>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 ml-auto">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${isAdmin ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-slate-700/50 text-slate-300 border-slate-600"}`}>
                <Shield size={11} /> {student.role}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}`}>
                {isActive ? "Active" : "Disabled"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-3">
        <button
          onClick={() => setConfirming({ message: `${isActive ? "Disable" : "Enable"} ${student.name || student.email}'s account?`, danger: isActive, onConfirm: toggleActive })}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition ${isActive ? "border-rose-500/30 text-rose-400 hover:bg-rose-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"}`}
        >
          {isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
          {isActive ? "Disable Account" : "Enable Account"}
        </button>

        <button
          onClick={() => setConfirming({ message: `${isAdmin ? "Demote" : "Promote"} ${student.name || student.email} ${isAdmin ? "to student" : "to admin"}?`, danger: false, onConfirm: changeRole })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition"
        >
          {isAdmin ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
          {isAdmin ? "Demote to Student" : "Promote to Admin"}
        </button>

        <button
          onClick={() => setConfirming({ message: `Send a password reset email to ${student.email}?`, danger: false, onConfirm: sendReset })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition"
        >
          <KeyRound size={16} /> Send Password Reset
        </button>
      </motion.div>

      {/* Stats Summary */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Sessions",  value: sessions.length,           icon: Code,     color: "text-emerald-400" },
          { label: "Total Coding Time", value: formatDuration(totalTime), icon: Clock,    color: "text-violet-400" },
          { label: "Top Skill",        value: topSkill || "N/A",          icon: Shield,   color: "text-blue-400" },
          { label: "Avg AI Score",     value: avgAI !== null ? `${avgAI}%` : "N/A", icon: Keyboard, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 flex items-center gap-3">
            <Icon size={20} className={`${color} shrink-0`} />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
              <p className="text-lg font-bold text-white">{value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Languages */}
      {languages.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Languages Used</p>
          <div className="flex flex-wrap gap-2">
            {languages.map((lang, i) => (
              <span key={lang} className={`px-3 py-1.5 rounded-full text-sm font-semibold border capitalize ${
                ["bg-indigo-500/20 text-indigo-300 border-indigo-500/30","bg-cyan-500/20 text-cyan-300 border-cyan-500/30","bg-violet-500/20 text-violet-300 border-violet-500/30","bg-pink-500/20 text-pink-300 border-pink-500/30"][i % 4]
              }`}>{lang}</span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sessions Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">All Sessions</h2>
          <span className="text-xs text-slate-500">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No sessions found for this user.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-medium">
                <tr>
                  <th className="p-4 pl-6">Status</th>
                  <th className="p-4">Skill Level</th>
                  <th className="p-4">Language</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">AI Score</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right pr-6">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {sessions.map(session => {
                  const active = session.status === "active";
                  const lang = session.language || session.languagesUsed?.[0] || "—";
                  const duration = session.activeDuration || (session.totalDuration ? session.totalDuration / 1000 : 0) || session.stats?.duration || 0;
                  const aiScore = session.stats?.aiProbability ?? null;
                  const aiColor = aiScore >= 70 ? "text-rose-400" : aiScore >= 40 ? "text-amber-400" : "text-emerald-400";
                  return (
                    <tr
                      key={session.id}
                      onClick={() => navigate(`/admin/session/${session.id}`)}
                      className="hover:bg-slate-700/30 transition cursor-pointer group"
                    >
                      <td className="p-4 pl-6">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex w-fit items-center gap-1.5 ${active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-slate-600/30"}`}>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                          {active ? "Active" : "Completed"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          session.stats?.skillLevel === "Advanced"     ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          session.stats?.skillLevel === "Intermediate" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          session.stats?.skillLevel === "Beginner"     ? "bg-slate-500/10 text-slate-400 border-slate-500/20" :
                          "bg-slate-700/40 text-slate-500 border-slate-700"
                        }`}>
                          {session.stats?.skillLevel || "N/A"}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 capitalize">{lang}</td>
                      <td className="p-4 text-slate-400 tabular-nums">{formatDuration(duration)}</td>
                      <td className={`p-4 font-semibold tabular-nums ${aiColor}`}>
                        {aiScore !== null ? `${aiScore}%` : "—"}
                      </td>
                      <td className="p-4 text-slate-500 text-sm tabular-nums whitespace-nowrap">{formatDate(session)}</td>
                      <td className="p-4 pr-6 text-right">
                        <ChevronRight size={16} className="ml-auto text-slate-600 group-hover:text-blue-400 transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default StudentDetail;
