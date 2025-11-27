import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

// Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword"; // <--- Import here

// Admin Components
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import StudentList from "./pages/admin/StudentList";
import SessionDetail from "./pages/admin/SessionDetail"; 
import Analytics from "./pages/admin/Analytics"; 

// User Components
import UserLayout from "./layouts/UserLayout";
import UserDashboard from "./pages/user/UserDashboard";
import UserProfile from "./pages/user/UserProfile"; 

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* --- Public Routes --- */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} /> {/* <--- Add Route */}
          
          {/* --- Admin Panel (Protected) --- */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="students" element={<StudentList />} />
            <Route path="session/:id" element={<SessionDetail />} />
            <Route path="analytics" element={<Analytics />} /> 
          </Route>

          {/* --- User/Student Panel (Private) --- */}
          <Route path="/user" element={<UserLayout />}>
            <Route path="dashboard" element={<UserDashboard />} />
            <Route path="history" element={<div className="p-8 text-white">Session History (Coming Soon)</div>} />
            <Route path="profile" element={<UserProfile />} />
          </Route>

          {/* --- Default Redirect --- */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;