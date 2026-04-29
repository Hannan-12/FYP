import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase/config";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase/config";
import { User, Mail, Calendar, Shield, Search, ChevronRight, ToggleLeft, ToggleRight, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const StudentList = () => {
  const navigate = useNavigate();
  const [students, setStudents]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [toast, setToast]         = useState(null);
  const [confirming, setConfirming] = useState(null); // { uid, action }

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const q = query(collection(db, "users"), where("role", "in", ["student", "admin"]));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error fetching students:", e);
    } finally {
      setLoading(false);
    }
  };

  // Toggle active/disabled
  const toggleActive = async (student) => {
    const newVal = student.isActive === false ? true : false;
    await updateDoc(doc(db, "users", student.id), { isActive: newVal });
    setStudents(prev => prev.map(s => s.id === student.id ? { ...s, isActive: newVal } : s));
    showToast(`${student.name || student.email} ${newVal ? "enabled" : "disabled"}.`);
    setConfirming(null);
  };

  // Change role
  const changeRole = async (student) => {
    const newRole = student.role === "admin" ? "student" : "admin";
    await updateDoc(doc(db, "users", student.id), { role: newRole });
    setStudents(prev => prev.map(s => s.id === student.id ? { ...s, role: newRole } : s));
    showToast(`${student.name || student.email} is now ${newRole}.`);
    setConfirming(null);
  };

  // Send password reset
  const sendReset = async (student) => {
    await sendPasswordResetEmail(auth, student.email);
    showToast(`Password reset email sent to ${student.email}.`);
    setConfirming(null);
  };

  const filtered = students.filter(s => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
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
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-white font-bold text-lg mb-2">Confirm Action</h3>
              <p className="text-slate-400 text-sm mb-6">{confirming.message}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirming(null)}
                  className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirming.onConfirm}
                  className={`flex-1 py-2 rounded-lg text-white text-sm font-bold transition ${
                    confirming.danger ? "bg-rose-600 hover:bg-rose-500" : "bg-blue-600 hover:bg-blue-500"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">User Management</h1>
          <p className="text-slate-400 mt-1 text-sm">Manage roles, access, and accounts.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/40 backdrop-blur-md border border-slate-700 rounded-2xl overflow-hidden shadow-xl"
      >
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading users...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">{search ? "No users match your search." : "No users registered yet."}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-medium">
                <tr>
                  <th className="p-4 pl-6">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Joined</th>
                  <th className="p-4 text-center">Actions</th>
                  <th className="p-4 text-right pr-6">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((student, idx) => {
                  const isActive = student.isActive !== false;
                  const isAdmin  = student.role === "admin";
                  return (
                    <motion.tr
                      key={student.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                      className={`transition ${!isActive ? "opacity-50" : ""}`}
                    >
                      {/* User */}
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg font-bold text-white text-sm shrink-0 ${isAdmin ? "bg-gradient-to-br from-blue-500 to-blue-700" : "bg-gradient-to-br from-indigo-500 to-violet-600"}`}>
                            {student.name?.[0]?.toUpperCase() || student.email?.[0]?.toUpperCase() || "U"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-200 truncate">{student.name || "—"}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1 truncate"><Mail size={11} />{student.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex w-fit items-center gap-1 ${
                          isAdmin
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-slate-700/50 text-slate-300 border-slate-600"
                        }`}>
                          <Shield size={11} />
                          {student.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {isActive ? "Active" : "Disabled"}
                        </span>
                      </td>

                      {/* Joined */}
                      <td className="p-4 text-slate-500 text-sm whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar size={13} className="text-slate-600" />
                          {student.createdAt ? new Date(student.createdAt.seconds * 1000).toLocaleDateString() : "—"}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {/* Toggle active */}
                          <button
                            title={isActive ? "Disable account" : "Enable account"}
                            onClick={() => setConfirming({
                              message: `${isActive ? "Disable" : "Enable"} account for ${student.name || student.email}?`,
                              danger: isActive,
                              onConfirm: () => toggleActive(student)
                            })}
                            className={`p-2 rounded-lg transition ${isActive ? "text-emerald-400 hover:bg-emerald-500/10" : "text-rose-400 hover:bg-rose-500/10"}`}
                          >
                            {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>

                          {/* Change role */}
                          <button
                            title={isAdmin ? "Demote to student" : "Promote to admin"}
                            onClick={() => setConfirming({
                              message: `${isAdmin ? "Demote" : "Promote"} ${student.name || student.email} ${isAdmin ? "to student" : "to admin"}?`,
                              danger: false,
                              onConfirm: () => changeRole(student)
                            })}
                            className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition"
                          >
                            {isAdmin ? <ShieldOff size={18} /> : <ShieldCheck size={18} />}
                          </button>

                          {/* Password reset */}
                          <button
                            title="Send password reset email"
                            onClick={() => setConfirming({
                              message: `Send a password reset email to ${student.email}?`,
                              danger: false,
                              onConfirm: () => sendReset(student)
                            })}
                            className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition"
                          >
                            <KeyRound size={18} />
                          </button>
                        </div>
                      </td>

                      {/* View sessions */}
                      <td className="p-4 pr-6 text-right">
                        <button
                          onClick={() => navigate(`/admin/student/${student.id}`)}
                          className="flex items-center gap-1 ml-auto text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                        >
                          View Sessions <ChevronRight size={14} />
                        </button>
                      </td>
                    </motion.tr>
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

export default StudentList;
