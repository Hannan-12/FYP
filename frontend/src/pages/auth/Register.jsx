import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase/config";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { motion } from "framer-motion";
import { UserPlus, Loader2, ArrowRight, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";

// RFC 5322 simplified — handles local@domain, subdomains, country+institution TLDs like .edu.pk
const EMAIL_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._%+\-]*[a-zA-Z0-9]@[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

const validateEmail = (email) => {
  const t = email.trim();
  if (!t) return false;
  if (t.includes("..")) return false;                // consecutive dots invalid
  const atIdx = t.lastIndexOf("@");
  if (atIdx < 1) return false;                       // must have chars before @
  const local = t.slice(0, atIdx);
  const domain = t.slice(atIdx + 1);
  if (!domain || domain.startsWith(".") || domain.endsWith(".")) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  // Catch gmail.com.com — last two domain segments identical
  const parts = domain.split(".");
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toLowerCase();
    const secondLast = parts[parts.length - 2].toLowerCase();
    if (last === secondLast) return false;
  }
  return EMAIL_REGEX.test(t);
};

const PwdCheck = ({ ok, label }) => (
  <div className={`flex items-center gap-1.5 text-xs ${ok ? "text-green-400" : "text-slate-500"}`}>
    {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
    {label}
  </div>
);

const Register = () => {
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pwdFocused, setPwdFocused] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const emailValid = validateEmail(formData.email);
  const showEmailError = emailTouched && !emailValid;
  const showEmailOk = emailTouched && emailValid;

  const pwd = formData.password;
  const pwdChecks = {
    length:    pwd.length >= 12,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    number:    /[0-9]/.test(pwd),
    special:   /[^A-Za-z0-9]/.test(pwd),
  };
  const allChecksPassed = Object.values(pwdChecks).every(Boolean);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = formData.email.trim();
    setEmailTouched(true);
    if (!validateEmail(trimmedEmail)) {
      return setError("Please enter a valid email address.");
    }
    if (formData.password !== formData.confirmPassword) return setError("Passwords do not match.");
    if (!allChecksPassed) return setError("Password does not meet all requirements.");

    setLoading(true);
    try {
      const trimmedPassword = formData.password.trim();
      const trimmedName = formData.name.trim();

      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: trimmedName,
        email: trimmedEmail,
        role: "student",
        createdAt: serverTimestamp()
      });

      navigate("/user/dashboard");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please meet all requirements.");
      } else {
        setError("Failed to create account. Please try again.");
      }
    }
    setLoading(false);
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      await loginWithGoogle();
      navigate("/user/dashboard");
    } catch (err) {
      setGoogleLoading(false);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed. Please try again.");
      } else {
        setError(`Google sign-up failed: ${err.message || "Please try again."}`);
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0f172a] font-sans">
      {/* Left Side */}
      <div className="hidden lg:flex w-1/2 bg-cyan-900 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-800 to-blue-900 opacity-90" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
        <div className="relative z-10 text-center px-12">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <h1 className="text-5xl font-bold text-white mb-6">Join the Community</h1>
            <p className="text-cyan-100 text-xl leading-relaxed">
              Start your journey to coding mastery. Track progress, analyze skills, and improve daily.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
            <p className="text-slate-400 mb-8">Sign up to get started.</p>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                <input
                  type="text"
                  name="name"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white outline-none transition-all"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="text"
                  name="email"
                  autoComplete="email"
                  className={`w-full px-4 py-3 bg-slate-800 border rounded-lg focus:ring-2 text-white outline-none transition-all ${
                    showEmailError ? "border-red-500 focus:ring-red-500/40" :
                    showEmailOk   ? "border-green-500 focus:ring-green-500/40" :
                    "border-slate-700 focus:ring-cyan-500"
                  }`}
                  placeholder="student@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => formData.email && setEmailTouched(true)}
                  required
                />
                {showEmailError && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <XCircle size={12} /> Invalid email address
                  </p>
                )}
                {showEmailOk && (
                  <p className="mt-1 text-xs text-green-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Valid email
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    className="w-full px-4 py-3 pr-12 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white outline-none transition-all"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setPwdFocused(true)}
                    onBlur={() => setPwdFocused(false)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {(pwdFocused || pwd.length > 0) && (
                  <div className="mt-2 p-3 bg-slate-800/80 border border-slate-700 rounded-lg grid grid-cols-2 gap-1.5">
                    <PwdCheck ok={pwdChecks.length}    label="Min 12 characters" />
                    <PwdCheck ok={pwdChecks.uppercase} label="Uppercase letter" />
                    <PwdCheck ok={pwdChecks.lowercase} label="Lowercase letter" />
                    <PwdCheck ok={pwdChecks.number}    label="Number" />
                    <PwdCheck ok={pwdChecks.special}   label="Special character" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    className="w-full px-4 py-3 pr-12 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white outline-none transition-all"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full mt-6 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3.5 rounded-lg transition-all transform active:scale-95 flex items-center justify-center shadow-lg shadow-cyan-500/25"
              >
                {loading ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2">Sign Up <ArrowRight size={18} /></span>}
              </button>
            </form>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-slate-700" />
              <span className="mx-4 text-slate-500 text-sm">or</span>
              <div className="flex-1 border-t border-slate-700" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-3.5 rounded-lg transition-all transform active:scale-95 shadow-md"
            >
              {googleLoading ? (
                <Loader2 className="animate-spin text-gray-600" size={20} />
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    <path fill="none" d="M0 0h48v48H0z"/>
                  </svg>
                  Sign up with Google
                </>
              )}
            </button>

            <p className="mt-8 text-center text-slate-400 text-sm">
              Already have an account?{" "}
              <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline">
                Log in
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Register;
