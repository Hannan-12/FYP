import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Code2, Brain, Shield, Target, ChevronRight, Github,
  Activity, TrendingUp, Zap, CheckCircle, ArrowRight,
  Terminal, BarChart3, BookOpen
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" },
  }),
};

// ─── Navbar ──────────────────────────────────────────────────────────────────
const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800">
    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Code2 size={18} className="text-white" />
        </div>
        <span className="text-white font-bold text-lg">DevSkill</span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/login"
          className="text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Sign In
        </Link>
        <Link
          to="/register"
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5"
        >
          Get Started <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  </nav>
);

// ─── Hero ─────────────────────────────────────────────────────────────────────
const Hero = () => (
  <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
    {/* Background blobs */}
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-indigo-700 rounded-full filter blur-[120px] opacity-20"
    />
    <motion.div
      animate={{ rotate: -360 }}
      transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-purple-700 rounded-full filter blur-[120px] opacity-20"
    />

    <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
        className="inline-flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 text-sm px-4 py-1.5 rounded-full mb-8"
      >
        <Zap size={14} />
        AI-Powered Developer Skill Tracker
      </motion.div>

      <motion.h1
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
        className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6"
      >
        Track your growth.
        <br />
        <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Master your craft.
        </span>
      </motion.h1>

      <motion.p
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={2}
        className="text-slate-400 text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
      >
        DevSkill automatically captures your coding activity through a VS Code extension,
        classifies your skill level with CodeBERT, detects AI-generated code, and gives
        you personalized quests to grow faster.
      </motion.p>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={3}
        className="flex flex-col sm:flex-row items-center justify-center gap-4"
      >
        <Link
          to="/register"
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-bold text-base transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/25"
        >
          Get Started Free <ArrowRight size={18} />
        </Link>
        <Link
          to="/login"
          className="border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white px-8 py-4 rounded-xl font-medium text-base transition-all"
        >
          Sign In
        </Link>
      </motion.div>

      {/* Stats row */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={4}
        className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto"
      >
        {[
          { label: "Skill levels", value: "3" },
          { label: "Features", value: "10+" },
          { label: "Free forever", value: "100%" },
        ].map((s) => (
          <div key={s.label}>
            <div className="text-3xl font-extrabold text-white">{s.value}</div>
            <div className="text-slate-500 text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  </section>
);

// ─── Features ─────────────────────────────────────────────────────────────────
const features = [
  {
    icon: Activity,
    color: "indigo",
    title: "Real-time Tracking",
    desc: "The VS Code extension silently records keystrokes, file edits, language usage, and session time while you code — zero friction.",
  },
  {
    icon: Brain,
    color: "purple",
    title: "Skill Classification",
    desc: "A fine-tuned CodeBERT model analyzes your code and labels each session as Beginner, Intermediate, or Advanced with high accuracy.",
  },
  {
    icon: Shield,
    color: "pink",
    title: "AI Detection",
    desc: "Statistical and heuristic signals detect LLM-generated code so your skill score reflects what you actually wrote yourself.",
  },
  {
    icon: Target,
    color: "cyan",
    title: "Personalized Quests",
    desc: "Claude AI generates practice challenges targeted at your weakest areas, with a curated fallback pool always available.",
  },
  {
    icon: BarChart3,
    color: "emerald",
    title: "Progress Dashboard",
    desc: "Visualize skill trends, session history, per-language breakdowns, and quest completion all in one clean dashboard.",
  },
  {
    icon: TrendingUp,
    color: "amber",
    title: "Admin Analytics",
    desc: "Instructors get a bird's-eye view of all students — track class-wide progress, flag outliers, and manage quests.",
  },
];

const colorMap = {
  indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  pink: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const Features = () => (
  <section className="py-28 px-6">
    <div className="max-w-7xl mx-auto">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <p className="text-indigo-400 font-semibold text-sm uppercase tracking-widest mb-3">Features</p>
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
          Everything you need to level up
        </h2>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          From raw keystrokes to actionable insights — DevSkill handles the full pipeline.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={i * 0.5}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors group"
          >
            <div className={`inline-flex p-3 rounded-xl border mb-4 ${colorMap[f.color]}`}>
              <f.icon size={22} />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ─── How it works ─────────────────────────────────────────────────────────────
const steps = [
  {
    icon: Terminal,
    num: "01",
    title: "Install the Extension",
    desc: "Install the DevSkill Tracker extension in VS Code, sign in with your account, and start tracking is automatic from there.",
  },
  {
    icon: Code2,
    num: "02",
    title: "Code Normally",
    desc: "Work on any project in any language. The extension captures your session silently in the background — no interruption to your workflow.",
  },
  {
    icon: BookOpen,
    num: "03",
    title: "Review & Improve",
    desc: "Open the dashboard to see your skill level, AI usage score, session history, and personalized quests to target your weak spots.",
  },
];

const HowItWorks = () => (
  <section className="py-28 px-6 bg-slate-900/50">
    <div className="max-w-5xl mx-auto">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <p className="text-indigo-400 font-semibold text-sm uppercase tracking-widest mb-3">How it works</p>
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Up and running in minutes</h2>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">Three simple steps. No config files. No setup headaches.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((s, i) => (
          <motion.div
            key={s.num}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            custom={i * 0.5}
            className="relative text-center"
          >
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-slate-700 to-transparent" />
            )}
            <div className="inline-flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-4 relative">
                <s.icon size={30} className="text-indigo-400" />
                <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {i + 1}
                </span>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Tech Stack ───────────────────────────────────────────────────────────────
const techs = [
  "React 19", "FastAPI", "CodeBERT", "Firebase",
  "Anthropic Claude", "Tailwind CSS", "PyTorch", "Hugging Face",
];

const TechStack = () => (
  <section className="py-20 px-6">
    <div className="max-w-4xl mx-auto text-center">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <p className="text-slate-500 text-sm uppercase tracking-widest mb-8 font-medium">Built with</p>
        <div className="flex flex-wrap justify-center gap-3">
          {techs.map((t) => (
            <span
              key={t}
              className="bg-slate-900 border border-slate-800 text-slate-300 px-4 py-2 rounded-full text-sm font-medium hover:border-indigo-500/50 hover:text-indigo-400 transition-colors cursor-default"
            >
              {t}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

// ─── CTA Banner ───────────────────────────────────────────────────────────────
const CTA = () => (
  <section className="py-28 px-6">
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="max-w-4xl mx-auto relative rounded-3xl overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-700" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500 rounded-full filter blur-3xl opacity-30"
      />
      <div className="relative z-10 text-center px-8 py-16">
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
          Start tracking your growth today
        </h2>
        <p className="text-indigo-200 text-lg mb-8 max-w-xl mx-auto">
          Create a free account, install the extension, and get your first skill report within minutes.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/register"
            className="bg-white hover:bg-indigo-50 text-indigo-700 font-bold px-8 py-4 rounded-xl transition-colors flex items-center gap-2"
          >
            Create Free Account <ArrowRight size={18} />
          </Link>
          <Link
            to="/login"
            className="border border-white/30 hover:border-white/60 text-white font-medium px-8 py-4 rounded-xl transition-colors flex items-center gap-2"
          >
            Sign In
          </Link>
        </div>
        <div className="mt-8 flex items-center justify-center gap-6 text-indigo-200 text-sm">
          {["No credit card", "Free forever", "Open source"].map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <CheckCircle size={14} /> {item}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  </section>
);

// ─── Footer ───────────────────────────────────────────────────────────────────
const Footer = () => (
  <footer className="border-t border-slate-800 py-10 px-6">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Code2 size={14} className="text-white" />
        </div>
        <span className="text-white font-bold">DevSkill</span>
        <span className="text-slate-600 text-sm ml-2">Final Year Project — Muhammad Hannan Hafeez</span>
      </div>
      <div className="flex items-center gap-6 text-slate-500 text-sm">
        <Link to="/login" className="hover:text-slate-300 transition-colors">Sign In</Link>
        <Link to="/register" className="hover:text-slate-300 transition-colors">Register</Link>
        <a
          href="https://github.com/Hannan-12/FYP"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-300 transition-colors flex items-center gap-1.5"
        >
          <Github size={14} /> GitHub
        </a>
      </div>
    </div>
  </footer>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const LandingPage = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && userRole) {
      navigate(userRole === "admin" ? "/admin/dashboard" : "/user/dashboard", { replace: true });
    }
  }, [user, userRole, navigate]);

  return (
    <div className="min-h-screen bg-[#0f172a] font-sans">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <TechStack />
      <CTA />
      <Footer />
    </div>
  );
};

export default LandingPage;
