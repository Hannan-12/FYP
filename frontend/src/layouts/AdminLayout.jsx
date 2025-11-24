import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, Users, FileText, LogOut, Activity } from "lucide-react";

const AdminLayout = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path ? "bg-blue-700" : "";

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white flex flex-col">
        <div className="p-6 text-2xl font-bold border-b border-blue-800">
          DevSkill Admin
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/admin/dashboard" className={`flex items-center space-x-3 p-3 rounded hover:bg-blue-800 transition ${isActive('/admin/dashboard')}`}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          
          <Link to="/admin/students" className={`flex items-center space-x-3 p-3 rounded hover:bg-blue-800 transition ${isActive('/admin/students')}`}>
            <Users size={20} />
            <span>Students</span>
          </Link>

          <Link to="/admin/analytics" className={`flex items-center space-x-3 p-3 rounded hover:bg-blue-800 transition ${isActive('/admin/analytics')}`}>
            <Activity size={20} />
            <span>Analytics</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-blue-800">
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 p-3 w-full rounded hover:bg-red-600 transition text-red-100"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet /> {/* This is where the dashboard content will appear */}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;