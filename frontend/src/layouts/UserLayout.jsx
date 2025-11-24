import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, History, User, LogOut } from "lucide-react";

const UserLayout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path ? "bg-indigo-700" : "";

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Indigo for Students to differentiate from Admin Blue */}
      <aside className="w-64 bg-indigo-900 text-white flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold">DevSkill Student</h2>
          <p className="text-xs text-indigo-300 mt-1">{user?.email}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/user/dashboard" className={`flex items-center space-x-3 p-3 rounded hover:bg-indigo-800 transition ${isActive('/user/dashboard')}`}>
            <LayoutDashboard size={20} />
            <span>My Overview</span>
          </Link>
          
          <Link to="/user/history" className={`flex items-center space-x-3 p-3 rounded hover:bg-indigo-800 transition ${isActive('/user/history')}`}>
            <History size={20} />
            <span>Session History</span>
          </Link>

          <Link to="/user/profile" className={`flex items-center space-x-3 p-3 rounded hover:bg-indigo-800 transition ${isActive('/user/profile')}`}>
            <User size={20} />
            <span>My Profile</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-indigo-800">
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 p-3 w-full rounded hover:bg-red-600 transition text-red-100"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default UserLayout;