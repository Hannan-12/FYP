import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut, User, Home, Code2 } from "lucide-react";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (!user) return null;

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-white font-bold text-xl">
          <Code2 className="text-indigo-400" size={28} />
          DevSkill
        </Link>

        <div className="flex items-center gap-6">
          <Link
            to="/user/dashboard"
            className="text-slate-300 hover:text-white flex items-center gap-2 transition"
          >
            <Home size={18} />
            Dashboard
          </Link>

          <div className="flex items-center gap-3 text-slate-300">
            <User size={18} />
            <span className="text-sm">{user.email}</span>
          </div>

          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-400 flex items-center gap-2 transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
