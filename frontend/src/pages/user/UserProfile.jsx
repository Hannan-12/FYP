import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/config";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { User, Mail, Shield, Calendar, Save, Loader2, Camera } from "lucide-react";

const UserProfile = () => {
  const { user } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  // Helper to format date
  const getJoinedDate = () => {
    // 1. Try Firestore timestamp
    if (userData?.createdAt?.seconds) {
      return new Date(userData.createdAt.seconds * 1000).toLocaleDateString();
    }
    // 2. Fallback to Auth Metadata (Works for all users)
    if (user?.metadata?.creationTime) {
      return new Date(user.metadata.creationTime).toLocaleDateString();
    }
    return "N/A";
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.uid) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            setName(data.name || "");
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      }
      setLoading(false);
    };
    fetchUserData();
  }, [user]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, { name: name });
      setMessage("Profile updated successfully!");
      // Update local state immediately
      setUserData(prev => ({ ...prev, name: name }));
      
      // Force a reload to update the sidebar name (Simple solution)
      // Ideally, use a global Context for profile data to avoid reload
      setTimeout(() => window.location.reload(), 1000); 
      
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("Failed to update profile.");
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading profile...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">My Profile</h1>
        <p className="text-slate-400 mt-2">Manage your account settings and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Profile Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-1 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-6 text-center shadow-xl h-fit"
        >
          <div className="relative w-32 h-32 mx-auto mb-6">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-2xl shadow-indigo-500/30">
              {name ? name[0].toUpperCase() : "U"}
            </div>
          </div>
          
          <h2 className="text-xl font-bold text-white mb-1">{name || "Student"}</h2>
          <p className="text-slate-400 text-sm mb-6">{user?.email}</p>

          <div className="flex justify-center gap-4">
            <div className="bg-slate-700/50 px-4 py-2 rounded-xl border border-slate-600">
              <span className="block text-xs text-slate-500 uppercase tracking-wider">Role</span>
              <span className="font-bold text-indigo-400 capitalize">{userData?.role || "Student"}</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Edit Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-1 lg:col-span-2 bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-8 shadow-xl"
        >
          <h3 className="text-xl font-bold text-white mb-6">Personal Information</h3>
          
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white transition-all outline-none"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-3.5 text-slate-500" />
                  <input
                    type="email"
                    value={user?.email}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/30 border border-slate-700 rounded-lg text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Account Role</label>
                <div className="relative">
                  <Shield size={18} className="absolute left-3 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={userData?.role || "student"}
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/30 border border-slate-700 rounded-lg text-slate-500 capitalize cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Joined Date</label>
                <div className="relative">
                  <Calendar size={18} className="absolute left-3 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    // --- UPDATED DATE LOGIC ---
                    value={getJoinedDate()} 
                    disabled
                    className="w-full pl-10 pr-4 py-3 bg-slate-900/30 border border-slate-700 rounded-lg text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-700 flex items-center justify-between">
              {message && (
                <span className={`text-sm ${message.includes("success") ? "text-emerald-400" : "text-red-400"}`}>
                  {message}
                </span>
              )}
              <div className="ml-auto">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-6 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default UserProfile;