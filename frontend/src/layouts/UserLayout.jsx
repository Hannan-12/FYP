import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { LayoutDashboard, History, User, LogOut, Trophy, Target, Globe, Menu, X } from "lucide-react";
import { motion } from "framer-motion";

const UserLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.uid) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          }
        } catch (error) {
          console.error("Error fetching sidebar profile:", error);
        }
      }
    };
    fetchProfile();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const NavItem = ({ to, icon: Icon, label }) => {
    const active = location.pathname === to;
    return (
      <Link to={to} className="relative flex items-center p-3 my-2 rounded-xl overflow-hidden">
        {active && (
          <motion.div
            layoutId="activeTab"
            className="absolute inset-0 bg-white/10 rounded-xl"
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        <div className={`flex items-center transition-colors z-10 ${active ? 'text-white' : 'text-indigo-200 hover:text-white'}`}>
          <Icon size={24} className="min-w-[24px]" />
          <span className={`ml-4 font-medium whitespace-nowrap transition-all duration-300 ${isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"}`}>
            {label}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-100 overflow-hidden font-sans min-w-[960px]">
      <aside className={`h-screen bg-slate-900 border-r border-slate-800 flex flex-col relative z-20 transition-all duration-300 ease-in-out ${isOpen ? "w-64" : "w-20"}`}>

        {/* Header / Logo + Toggle */}
        <div className="p-4 flex items-center justify-between overflow-hidden">
          <div className={`flex items-center overflow-hidden transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 w-0"}`}>
            <div className="w-8 h-8 min-w-[32px] bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="font-bold text-white text-lg">D</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white ml-3 whitespace-nowrap">
              DevSkill
            </h2>
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
            className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Profile Summary - Only visible when open */}
        <div className="px-4 mb-4">
          <div className={`bg-slate-800/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm overflow-hidden transition-all duration-300 ${isOpen ? "h-auto opacity-100 p-4" : "h-0 opacity-0"}`}>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 whitespace-nowrap">
              {profile?.role || "Student"}
            </p>
            <p className="text-sm font-medium text-white truncate">
              {profile?.name || user?.email}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3">
          <NavItem to="/user/dashboard" icon={LayoutDashboard} label="Overview" />
          <NavItem to="/user/quests" icon={Target} label="Quests" />
          <NavItem to="/user/progress" icon={Trophy} label="Progress" />
          <NavItem to="/user/languages" icon={Globe} label="Languages" />
          <NavItem to="/user/history" icon={History} label="History" />
          <NavItem to="/user/profile" icon={User} label="Profile" />
        </nav>

        {/* Logout Button */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center p-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 transition duration-200 overflow-hidden"
          >
            <LogOut size={24} className="min-w-[24px]" />
            <span className={`ml-4 whitespace-nowrap transition-all duration-300 ${isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"}`}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-[#0f172a]">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none" />
        <div className="p-8 relative z-10 max-w-7xl mx-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default UserLayout;