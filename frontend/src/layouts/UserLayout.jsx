import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { LayoutDashboard, History, User, LogOut, Trophy, Target } from "lucide-react";
import { motion } from "framer-motion";

const UserLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);

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
      <Link to={to} className="relative flex items-center p-3 my-2 rounded-xl group/item overflow-hidden">
        {active && (
          <motion.div
            layoutId="activeTab"
            className="absolute inset-0 bg-white/10 rounded-xl"
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        <div className={`flex items-center transition-colors z-10 ${active ? 'text-white' : 'text-indigo-200 group-hover/item:text-white'}`}>
          {/* Icon stays fixed size */}
          <Icon size={24} className="min-w-[24px]" />
          {/* Label animates opacity and position */}
          <span className="ml-4 font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0">
            {label}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-100 overflow-hidden font-sans">
      {/* SIDEBAR: 
         - Default width: w-20 
         - Hover width: w-64 
         - Transition applied to width
      */}
      <aside className="h-screen bg-slate-900 border-r border-slate-800 flex flex-col relative z-20 transition-all duration-300 ease-in-out w-20 hover:w-64 group">
        
        {/* Header / Logo Area */}
        <div className="p-6 flex items-center overflow-hidden">
          <div className="w-8 h-8 min-w-[32px] bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="font-bold text-white text-lg">D</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            DevSkill
          </h2>
        </div>
        
        {/* Profile Summary - Only visible on hover */}
        <div className="px-4 mb-4">
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm overflow-hidden transition-all duration-300 h-0 opacity-0 group-hover:h-auto group-hover:opacity-100 group-hover:p-4">
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
            <span className="ml-4 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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