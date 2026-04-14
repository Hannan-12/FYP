import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, Users, Activity, LogOut, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const AdminLayout = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
            layoutId="activeAdminTab"
            className="absolute inset-0 bg-blue-500/20 rounded-xl border border-blue-500/30"
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        <div className={`flex items-center transition-colors z-10 ${active ? 'text-blue-100' : 'text-slate-400 group-hover/item:text-white'}`}>
          <Icon size={24} className={`min-w-[24px] ${active ? "text-blue-400" : ""}`} />
          <span className="ml-4 font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-[-10px] group-hover:translate-x-0">
            {label}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-[#0b1121] text-slate-100 overflow-hidden font-sans">
      {/* SIDEBAR: 
         - Width: w-20 -> w-64 on hover
      */}
      <aside className="h-screen bg-slate-900/50 border-r border-slate-800 flex flex-col backdrop-blur-xl relative z-20 transition-all duration-300 ease-in-out w-20 hover:w-64 group">
        
        {/* Header */}
        <div className="p-6 flex items-center overflow-hidden">
          <div className="w-8 h-8 min-w-[32px] bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            AdminPanel
          </h2>
        </div>
        
        {/* Nav */}
        <nav className="flex-1 px-3">
          <NavItem to="/admin/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/admin/students" icon={Users} label="Students" />
          <NavItem to="/admin/analytics" icon={Activity} label="Analytics" />
        </nav>

        {/* Logout */}
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
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
        <div className="p-8 relative z-10 max-w-7xl mx-auto">
           <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;