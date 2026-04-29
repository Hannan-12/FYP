import { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { useEffect } from "react";
import { LayoutDashboard, Users, Activity, LogOut, ShieldCheck, Menu, X } from "lucide-react";
import { motion } from "framer-motion";

const AdminLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.uid) {
        try {
          const docSnap = await getDoc(doc(db, "users", user.uid));
          if (docSnap.exists()) setProfile(docSnap.data());
        } catch (e) {
          console.error("Error fetching admin profile:", e);
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
            layoutId="activeAdminTab"
            className="absolute inset-0 bg-blue-500/20 rounded-xl border border-blue-500/30"
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        <div className={`flex items-center transition-colors z-10 ${active ? "text-blue-100" : "text-slate-400 hover:text-white"}`}>
          <Icon size={24} className={`min-w-[24px] ${active ? "text-blue-400" : ""}`} />
          <span className={`ml-4 font-medium whitespace-nowrap transition-all duration-300 ${isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"}`}>
            {label}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-[#0b1121] text-slate-100 overflow-hidden font-sans min-w-[960px]">

      {/* Sidebar */}
      <aside className={`h-screen bg-slate-900/50 border-r border-slate-800 flex flex-col backdrop-blur-xl relative z-20 transition-all duration-300 ease-in-out ${isOpen ? "w-64" : "w-20"}`}>

        {/* Header / Logo + Toggle */}
        <div className="p-4 flex items-center justify-between overflow-hidden">
          <div className={`flex items-center overflow-hidden transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 w-0"}`}>
            <div className="w-8 h-8 min-w-[32px] bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white ml-3 whitespace-nowrap">
              AdminPanel
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

        {/* Profile Summary */}
        <div className="px-4 mb-4">
          <div className={`bg-slate-800/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm overflow-hidden transition-all duration-300 ${isOpen ? "h-auto opacity-100 p-4" : "h-0 opacity-0"}`}>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 whitespace-nowrap">
              {profile?.role || "Admin"}
            </p>
            <p className="text-sm font-medium text-white truncate">
              {profile?.name || user?.email}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3">
          <NavItem to="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/admin/students"  icon={Users}           label="Students" />
          <NavItem to="/admin/analytics" icon={Activity}        label="Analytics" />
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center p-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 transition duration-200"
          >
            <LogOut size={24} className="min-w-[24px]" />
            <span className={`ml-4 whitespace-nowrap transition-all duration-300 ${isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"}`}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-[#0b1121]">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
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

export default AdminLayout;
