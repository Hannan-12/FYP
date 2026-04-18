import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase/config";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { motion } from "framer-motion";
import { UserPlus, Loader2, ArrowRight, CheckCircle2, XCircle } from "lucide-react";

const EMAIL_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

const COMMON_TLDS = new Set(["com","net","org","edu","gov","io","co","uk","de","fr","in","pk","au","ca","us","info","biz","me","app","dev","ai"]);

const validateEmail = (email) => {
  const t = email.trim();
  if (!t) return false;
  if (t.includes("..")) return false;
  const [local, domain] = t.split("@");
  if (!domain) return false;
  if (local?.startsWith(".") || local?.endsWith(".")) return false;
  // Block duplicate trailing TLD: gmail.com.com
  const parts = domain.split(".");
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toLowerCase();
    const secondLast = parts[parts.length - 2].toLowerCase();
    if (last === secondLast) return false;
    // Block if last two parts are both known TLDs (e.g. .com.net)
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
  const [pwdFocused, setPwdFocused] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
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
                <input
                  type="password"
                  name="password"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white outline-none transition-all"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={() => setPwdFocused(true)}
                  onBlur={() => setPwdFocused(false)}
                  required
                />
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
                <input
                  type="password"
                  name="confirmPassword"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white outline-none transition-all"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3.5 rounded-lg transition-all transform active:scale-95 flex items-center justify-center shadow-lg shadow-cyan-500/25"
              >
                {loading ? <Loader2 className="animate-spin" /> : <span className="flex items-center gap-2">Sign Up <ArrowRight size={18} /></span>}
              </button>
            </form>

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
