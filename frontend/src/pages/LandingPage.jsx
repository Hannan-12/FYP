import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Code2, Brain, Shield, Target, Github, Activity,
  TrendingUp, Zap, CheckCircle, ArrowRight, Terminal,
  BarChart3, BookOpen, ChevronRight, Sparkles, Star,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─── Navbar ──────────────────────────────────────────────────────────────────
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0a0f1e]/90 backdrop-blur-xl border-b border-white/5 shadow-xl" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Code2 size={16} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">DevSkill</span>
          <span className="hidden sm:block text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-medium">FYP</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Sign In</Link>
          <Link to="/register" className="relative group bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-1.5">
            Get Started <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </nav>
  );
};

// ─── Code Editor Mockup ───────────────────────────────────────────────────────
const CodeMockup = () => {
  const lines = [
    { indent: 0, tokens: [{ c: "text-purple-400", t: "def " }, { c: "text-yellow-300", t: "analyze_session" }, { c: "text-white", t: "(code_snapshot):" }] },
    { indent: 1, tokens: [{ c: "text-slate-500", t: "# CodeBERT classifies skill level" }] },
    { indent: 1, tokens: [{ c: "text-indigo-300", t: "result " }, { c: "text-white", t: "= " }, { c: "text-cyan-400", t: "model" }, { c: "text-white", t: ".predict(code_snapshot)" }] },
    { indent: 1, tokens: [{ c: "text-purple-400", t: "return " }, { c: "text-white", t: "{" }] },
    { indent: 2, tokens: [{ c: "text-green-400", t: '"skill"' }, { c: "text-white", t: ": result.label," }] },
    { indent: 2, tokens: [{ c: "text-green-400", t: '"confidence"' }, { c: "text-white", t: ": result.score," }] },
    { indent: 2, tokens: [{ c: "text-green-400", t: '"ai_detected"' }, { c: "text-white", t: ": " }, { c: "text-orange-400", t: "detect_ai" }, { c: "text-white", t: "(code_snapshot)" }] },
    { indent: 1, tokens: [{ c: "text-white", t: "}" }] },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, rotateY: -5 }}
      animate={{ opacity: 1, x: 0, rotateY: 0 }}
      transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      {/* Glow behind */}
      <div className="absolute -inset-4 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-3xl blur-xl" />

      <div className="relative bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Editor header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
          <div className="ml-3 text-xs text-slate-500 font-mono">skill_analyzer.py</div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Tracking
          </div>
        </div>

        {/* Code lines */}
        <div className="p-5 font-mono text-sm leading-7 space-y-0">
          {lines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.08 }}
              className="flex"
            >
              <span className="text-slate-600 select-none w-6 shrink-0 text-right mr-4 text-xs leading-7">{i + 1}</span>
              <span style={{ paddingLeft: `${line.indent * 16}px` }}>
                {line.tokens.map((t, j) => (
                  <span key={j} className={t.c}>{t.t}</span>
                ))}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Output bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="border-t border-white/5 px-5 py-3 bg-white/[0.02] flex items-center gap-3"
        >
          <span className="text-slate-500 text-xs font-mono">Output:</span>
          <span className="text-xs font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-full">skill: Intermediate</span>
          <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">confidence: 0.87</span>
          <span className="text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full">ai_detected: false</span>
        </motion.div>
      </div>

      {/* Floating stat cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 0.6 }}
        className="absolute -bottom-5 -left-8 bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 shadow-xl"
      >
        <div className="text-xs text-slate-500 mb-1">Skill Growth</div>
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-emerald-400" />
          <span className="text-white font-bold text-sm">+23%</span>
          <span className="text-emerald-400 text-xs">this week</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.2, duration: 0.6 }}
        className="absolute -top-5 -right-6 bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 shadow-xl"
      >
        <div className="text-xs text-slate-500 mb-1">Session score</div>
        <div className="flex items-center gap-2">
          <Star size={14} className="text-yellow-400" />
          <span className="text-white font-bold text-sm">Advanced</span>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Hero ─────────────────────────────────────────────────────────────────────
const Hero = () => (
  <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
    {/* Grid background */}
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:64px_64px]" />
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0f1e]" />

    {/* Glow blobs */}
    <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 8, repeat: Infinity }} className="absolute top-20 left-[10%] w-[400px] h-[400px] bg-indigo-700 rounded-full filter blur-[100px] opacity-15" />
    <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 10, repeat: Infinity, delay: 2 }} className="absolute bottom-20 right-[10%] w-[400px] h-[400px] bg-purple-700 rounded-full filter blur-[100px] opacity-15" />

    <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
      {/* Left */}
      <div>
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-indigo-400 text-xs px-4 py-2 rounded-full mb-6 font-medium">
          <Sparkles size={12} /> AI-Powered Developer Skill Intelligence
        </motion.div>

        <motion.h1 variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="text-5xl xl:text-6xl font-extrabold text-white leading-[1.1] mb-6 tracking-tight">
          Track your growth.<br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Master your craft.
          </span>
        </motion.h1>

        <motion.p variants={fadeUp} initial="hidden" animate="visible" custom={2}
          className="text-slate-400 text-lg leading-relaxed mb-8 max-w-lg">
          DevSkill captures live coding sessions via a VS Code extension, classifies your skill level
          with a fine-tuned CodeBERT model, detects AI-generated code, and gives you personalized
          quests to improve faster.
        </motion.p>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="flex flex-wrap gap-4 mb-10">
          <Link to="/register"
            className="group bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-7 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/30 flex items-center gap-2">
            Get Started Free
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link to="/login"
            className="border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white px-7 py-3.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2">
            Sign In
          </Link>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4} className="flex flex-wrap items-center gap-6">
          {[
            { icon: CheckCircle, label: "Free forever" },
            { icon: CheckCircle, label: "No credit card" },
            { icon: CheckCircle, label: "Open source" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-slate-500 text-sm">
              <Icon size={14} className="text-emerald-500" /> {label}
            </span>
          ))}
        </motion.div>
      </div>

      {/* Right */}
      <div className="hidden lg:block">
        <CodeMockup />
      </div>
    </div>
  </section>
);

// ─── Stats Bar ────────────────────────────────────────────────────────────────
const StatsBar = () => (
  <section className="py-12 border-y border-white/5 bg-white/[0.01]">
    <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
      {[
        { value: "3", label: "Skill Levels", sub: "Beginner → Advanced" },
        { value: "10+", label: "Tracked Metrics", sub: "Per session" },
        { value: "100%", label: "Free to Use", sub: "No paid tier" },
        { value: "Real-time", label: "Analysis", sub: "CodeBERT powered" },
      ].map((s, i) => (
        <motion.div key={s.label} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i * 0.3} className="text-center">
          <div className="text-3xl font-extrabold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-1">{s.value}</div>
          <div className="text-white font-semibold text-sm">{s.label}</div>
          <div className="text-slate-600 text-xs mt-0.5">{s.sub}</div>
        </motion.div>
      ))}
    </div>
  </section>
);

// ─── Features ─────────────────────────────────────────────────────────────────
const features = [
  { icon: Activity, grad: "from-indigo-500 to-indigo-700", glow: "indigo", title: "Real-time Tracking", desc: "Silently records keystrokes, file edits, language usage, and session time while you code — zero friction, zero interruption." },
  { icon: Brain, grad: "from-purple-500 to-purple-700", glow: "purple", title: "Skill Classification", desc: "Fine-tuned CodeBERT model labels each session as Beginner, Intermediate, or Advanced based on what you actually wrote." },
  { icon: Shield, grad: "from-pink-500 to-pink-700", glow: "pink", title: "AI-Code Detection", desc: "Heuristic and statistical signals identify LLM-generated code so your skill score reflects genuine effort, not AI output." },
  { icon: Target, grad: "from-cyan-500 to-cyan-700", glow: "cyan", title: "Personalized Quests", desc: "Claude AI generates targeted challenges aimed at your weakest areas, with a curated fallback pool always available offline." },
  { icon: BarChart3, grad: "from-emerald-500 to-emerald-700", glow: "emerald", title: "Progress Dashboard", desc: "Visualize skill trends over time, session history, per-language breakdowns, and quest completion all in one place." },
  { icon: TrendingUp, grad: "from-amber-500 to-amber-700", glow: "amber", title: "Admin Analytics", desc: "Instructors see class-wide progress, flag at-risk students, review session reports, and manage the quest pool." },
];

const glowColors = {
  indigo: "shadow-indigo-500/20 group-hover:shadow-indigo-500/40",
  purple: "shadow-purple-500/20 group-hover:shadow-purple-500/40",
  pink: "shadow-pink-500/20 group-hover:shadow-pink-500/40",
  cyan: "shadow-cyan-500/20 group-hover:shadow-cyan-500/40",
  emerald: "shadow-emerald-500/20 group-hover:shadow-emerald-500/40",
  amber: "shadow-amber-500/20 group-hover:shadow-amber-500/40",
};

const Features = () => (
  <section className="py-28 px-6">
    <div className="max-w-7xl mx-auto">
      <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-16">
        <p className="text-indigo-400 font-semibold text-xs uppercase tracking-[0.2em] mb-4">Features</p>
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5 tracking-tight">Everything you need to level up</h2>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">From raw keystrokes to actionable skill insights — DevSkill handles the full pipeline automatically.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f, i) => (
          <motion.div key={f.title} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i * 0.15}
            className={`group relative bg-[#0d1117] border border-white/5 hover:border-white/10 rounded-2xl p-6 transition-all duration-300 shadow-xl ${glowColors[f.glow]} hover:shadow-2xl hover:-translate-y-1`}>
            {/* Top gradient line */}
            <div className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r ${f.grad} opacity-0 group-hover:opacity-100 transition-opacity rounded-full`} />
            <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${f.grad} mb-5 shadow-lg`}>
              <f.icon size={20} className="text-white" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2.5">{f.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed group-hover:text-slate-400 transition-colors">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Session Report Preview ────────────────────────────────────────────────────
const SessionPreview = () => (
  <section className="py-28 px-6 bg-gradient-to-b from-transparent via-slate-900/30 to-transparent">
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
      <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
        <p className="text-indigo-400 font-semibold text-xs uppercase tracking-[0.2em] mb-4">Session Report</p>
        <h2 className="text-4xl font-extrabold text-white mb-5 tracking-tight leading-tight">Every session becomes a data point for your growth</h2>
        <p className="text-slate-400 text-lg leading-relaxed mb-8">After each coding session the extension submits your activity to the backend. Within seconds you get a full breakdown — skill level, AI score, time distribution, and a tailored quest to improve.</p>
        <div className="space-y-3">
          {["Skill level classified automatically", "AI-assistance percentage flagged", "Language and time breakdown", "Personalized improvement quest"].map((item) => (
            <div key={item} className="flex items-center gap-3 text-slate-300 text-sm">
              <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
                <CheckCircle size={11} className="text-indigo-400" />
              </div>
              {item}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Mock session card */}
      <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1} className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 rounded-3xl blur-xl" />
        <div className="relative bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm">Session Report</span>
            </div>
            <span className="text-slate-500 text-xs">Apr 15, 2026 · 2h 14m</span>
          </div>
          <div className="p-6 space-y-5">
            {/* Skill badge */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Skill Level</span>
              <span className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-300 px-4 py-1 rounded-full text-sm font-bold">Intermediate</span>
            </div>
            {/* Confidence bar */}
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>Confidence</span><span className="text-indigo-400 font-medium">87%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} whileInView={{ width: "87%" }} transition={{ duration: 1.2, delay: 0.3 }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
              </div>
            </div>
            {/* AI score */}
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>AI Assistance Detected</span><span className="text-emerald-400 font-medium">12%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} whileInView={{ width: "12%" }} transition={{ duration: 1, delay: 0.5 }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" />
              </div>
            </div>
            {/* Language chips */}
            <div>
              <p className="text-xs text-slate-500 mb-2">Languages</p>
              <div className="flex gap-2 flex-wrap">
                {[["Python", "62%", "indigo"], ["JavaScript", "28%", "yellow"], ["SQL", "10%", "cyan"]].map(([lang, pct, c]) => (
                  <span key={lang} className={`text-xs px-3 py-1 rounded-full border bg-${c}-500/10 border-${c}-500/20 text-${c}-400`}>
                    {lang} · {pct}
                  </span>
                ))}
              </div>
            </div>
            {/* Quest */}
            <div className="bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-indigo-500/15 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target size={14} className="text-indigo-400" />
                <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Suggested Quest</span>
              </div>
              <p className="text-white text-sm font-medium">Refactor a function to reduce cyclomatic complexity below 5</p>
              <p className="text-slate-500 text-xs mt-1">Based on your recent session patterns</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

// ─── How it Works ─────────────────────────────────────────────────────────────
const steps = [
  { icon: Terminal, num: "01", title: "Install the Extension", desc: "Install DevSkill Tracker from VS Code marketplace, sign in with your account. Tracking starts automatically." },
  { icon: Code2, num: "02", title: "Code Normally", desc: "Work on any project in any language. The extension runs silently — no interruption to your workflow whatsoever." },
  { icon: BookOpen, num: "03", title: "Review & Improve", desc: "Open the dashboard after any session to see your skill level, AI score, history, and a personalized quest to grow faster." },
];

const HowItWorks = () => (
  <section className="py-28 px-6">
    <div className="max-w-5xl mx-auto">
      <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-20">
        <p className="text-indigo-400 font-semibold text-xs uppercase tracking-[0.2em] mb-4">How it works</p>
        <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">Up and running in minutes</h2>
        <p className="text-slate-400 text-lg max-w-md mx-auto">Three steps. No config files. No setup overhead.</p>
      </motion.div>
      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Connector line */}
        <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
        {steps.map((s, i) => (
          <motion.div key={s.num} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i * 0.2} className="text-center relative">
            <div className="inline-flex flex-col items-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-[#0d1117] border border-white/10 flex items-center justify-center shadow-xl">
                  <s.icon size={28} className="text-indigo-400" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                  {i + 1}
                </div>
              </div>
              <h3 className="text-white font-bold text-lg mb-3">{s.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Tech Stack ───────────────────────────────────────────────────────────────
const techs = ["React 19", "FastAPI", "CodeBERT", "Firebase", "Anthropic Claude", "Tailwind CSS", "PyTorch", "Hugging Face", "Framer Motion", "Firestore"];

const TechStack = () => (
  <section className="py-16 px-6 border-y border-white/5">
    <div className="max-w-4xl mx-auto text-center">
      <p className="text-slate-600 text-xs uppercase tracking-[0.2em] mb-8 font-medium">Built with</p>
      <div className="flex flex-wrap justify-center gap-3">
        {techs.map((t, i) => (
          <motion.span key={t} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i * 0.05}
            className="bg-[#0d1117] border border-white/8 text-slate-400 px-4 py-2 rounded-full text-sm font-medium hover:border-indigo-500/40 hover:text-indigo-400 transition-all cursor-default">
            {t}
          </motion.span>
        ))}
      </div>
    </div>
  </section>
);

// ─── CTA ─────────────────────────────────────────────────────────────────────
const CTA = () => (
  <section className="py-28 px-6">
    <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
      className="max-w-4xl mx-auto relative rounded-3xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px]" />
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
        className="absolute -top-24 -right-24 w-72 h-72 bg-purple-500 rounded-full filter blur-3xl opacity-20" />
      <motion.div animate={{ rotate: -360 }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500 rounded-full filter blur-3xl opacity-20" />
      <div className="relative z-10 text-center px-8 py-20">
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white/80 text-xs px-4 py-1.5 rounded-full mb-6 font-medium">
          <Zap size={12} /> Start for free today
        </div>
        <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5 tracking-tight">
          Ready to track your real skill?
        </h2>
        <p className="text-indigo-200 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
          Create a free account, install the extension, and get your first AI-powered skill report within minutes.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/register"
            className="group bg-white hover:bg-indigo-50 text-indigo-700 font-bold px-8 py-4 rounded-xl transition-colors flex items-center gap-2 shadow-xl">
            Create Free Account
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link to="/login"
            className="border border-white/25 hover:border-white/50 text-white font-medium px-8 py-4 rounded-xl transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </motion.div>
  </section>
);

// ─── Footer ───────────────────────────────────────────────────────────────────
const Footer = () => (
  <footer className="border-t border-white/5 py-10 px-6">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
          <Code2 size={13} className="text-white" />
        </div>
        <span className="text-white font-bold text-sm">DevSkill</span>
        <span className="text-slate-600 text-xs">— Final Year Project by Muhammad Hannan Hafeez</span>
      </div>
      <div className="flex items-center gap-6 text-slate-600 text-sm">
        <Link to="/login" className="hover:text-slate-300 transition-colors">Sign In</Link>
        <Link to="/register" className="hover:text-slate-300 transition-colors">Register</Link>
        <a href="https://github.com/Hannan-12/FYP" target="_blank" rel="noopener noreferrer"
          className="hover:text-slate-300 transition-colors flex items-center gap-1.5">
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
    <div className="min-h-screen bg-[#0a0f1e] font-sans antialiased">
      <Navbar />
      <Hero />
      <StatsBar />
      <Features />
      <SessionPreview />
      <HowItWorks />
      <TechStack />
      <CTA />
      <Footer />
    </div>
  );
};

export default LandingPage;
