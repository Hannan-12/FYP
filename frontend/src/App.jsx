import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

// Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// Admin Components
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentList from "./pages/admin/StudentList";
import SessionDetail from "./pages/admin/SessionDetail"; 
import Analytics from "./pages/admin/Analytics"; 

// User Components
import UserLayout from "./layouts/UserLayout";
import UserDashboard from "./pages/user/UserDashboard";

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* --- Public Routes --- */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* --- Admin Panel (Protected) --- */}
          <Route path="/admin" element={<AdminLayout />}>
            {/* Main Dashboard */}
            <Route path="dashboard" element={<AdminDashboard />} />
            
            {/* Student Directory */}
            <Route path="students" element={<StudentList />} />
            
            {/* Session Detail View (Drill-Down) */}
            <Route path="session/:id" element={<SessionDetail />} />
            
            {/* Analytics Module */}
            <Route path="analytics" element={<Analytics />} /> 
          </Route>

          {/* --- User/Student Panel (Private) --- */}
          <Route path="/user" element={<UserLayout />}>
            {/* Student Dashboard */}
            <Route path="dashboard" element={<UserDashboard />} />
            
            {/* History Placeholder */}
            <Route path="history" element={<div className="p-8">Session History (Coming Soon)</div>} />
            
            {/* Profile Placeholder */}
            <Route path="profile" element={<div className="p-8">My Profile (Coming Soon)</div>} />
          </Route>

          {/* --- Default Redirect --- */}
          {/* Any unknown URL redirects to Login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;