import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { Brain, Trophy, Zap, ChevronLeft, Code2, Sparkles, Play, CheckCircle, XCircle, AlertTriangle, Globe, ArrowLeft, Star, ShieldCheck, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { db } from "../../firebase/config";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:8000" : "https://hannan-12-devskill-backend.hf.space");

// Monaco editor language IDs for detected languages
const MONACO_MAP = {
  python: "python", javascript: "javascript", typescript: "typescript",
  java: "java", csharp: "csharp", html: "html", css: "css",
  cpp: "cpp", c: "c", go: "go", rust: "rust", ruby: "ruby",
  php: "php", swift: "swift", kotlin: "kotlin", r: "r",
  sql: "sql", shell: "shell",
};

// File extensions per language
const EXT_MAP = {
  python: "py", javascript: "js", typescript: "ts", java: "java",
  csharp: "cs", html: "html", css: "css", cpp: "cpp", c: "c",
  go: "go", rust: "rs", ruby: "rb", php: "php", swift: "swift",
  kotlin: "kt", r: "r", sql: "sql", shell: "sh",
};

// Generate a sensible code template for any language
const getCodeTemplate = (lang, title, task) => {
  const comment = (style, t, d) => {
    if (style === "hash") return `# ${t}\n# Task: ${d}\n\n# Write your solution here:\n`;
    if (style === "html") return `<!-- ${t} -->\n<!-- Task: ${d} -->\n\n<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>${t}</title>\n    <style>\n        /* Write your CSS here */\n    </style>\n</head>\n<body>\n    <!-- Write your HTML here -->\n    \n</body>\n</html>\n`;
    if (style === "css") return `/* ${t} */\n/* Task: ${d} */\n\n/* Write your CSS here */\n`;
    if (style === "sql") return `-- ${t}\n-- Task: ${d}\n\n-- Write your SQL here\n`;
    return `// ${t}\n// Task: ${d}\n\n// Write your solution here:\n`;
  };

  const hashLangs = ["python", "ruby", "r", "shell"];
  if (hashLangs.includes(lang)) return comment("hash", title, task);
  if (lang === "html") return comment("html", title, task);
  if (lang === "css") return comment("css", title, task);
  if (lang === "sql") return comment("sql", title, task);
  return comment("slash", title, task);
};

const getFileExtension = (lang) => EXT_MAP[lang] || "txt";
const getMonacoId = (lang) => MONACO_MAP[lang] || lang;

const Quests = () => {
  // --- State ---
  const [quests, setQuests] = useState([]);
  const [activeQuest, setActiveQuest] = useState(null); // null = quest list view, object = solving view
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [code, setCode] = useState("");
  const [userSkillLevel, setUserSkillLevel] = useState("Beginner");
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [keystrokes, setKeystrokes] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [dailyMeta, setDailyMeta] = useState(null); // { date, cached, skillLevel, language }
  const startTimeRef = useRef(Date.now());
  const lastKeyTimeRef = useRef(null);
  // Behavioral signal trackers for AI detection
  const bsRef = useRef({
    totalClipboardPastes: 0,
    totalPasteCharacters: 0,
    totalDeletions: 0,
    deletionCharacters: 0,
    burstCount: 0,
    typingIntervals: [],
  });
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- Fetch quests for a specific language ---
  const fetchQuestsForLanguage = async (lang) => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    setSelectedLanguage(lang);
    try {
      const url = `${API_BASE_URL}/quests/daily/${user.uid}?language=${encodeURIComponent(lang)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      setQuests(data.quests || []);
      setDailyMeta({ date: data.date, cached: data.cached, skillLevel: data.skillLevel, language: lang });
      if (data.skillLevel) setUserSkillLevel(data.skillLevel);
    } catch (err) {
      setError("Unable to load quests. Make sure the backend is running.");
      setQuests([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Detect language and available languages from sessions ---
  useEffect(() => {
    const detectLanguage = async () => {
      if (!user?.uid) return;
      try {
        // Get user sessions to build language list
        const sessionsQuery = query(
          collection(db, "sessions"),
          where("userId", "==", user.uid),
          orderBy("timestamp", "desc"),
          limit(20)
        );
        let snap;
        try { snap = await getDocs(sessionsQuery); }
        catch { snap = await getDocs(query(collection(db, "sessions"), where("userId", "==", user.uid))); }

        const langSet = new Set();
        snap.forEach(d => {
          const s = d.data();
          (s.languagesUsed || []).forEach(l => langSet.add(l.toLowerCase()));
          if (s.language) langSet.add(s.language.toLowerCase());
        });

        // Also try the detect-language endpoint for the most recent one
        try {
          const resp = await fetch(`${API_BASE_URL}/detect-language/${user.uid}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.language) {
              setDetectedLanguage(data.language);
              langSet.add(data.language.toLowerCase());
            }
          }
        } catch { /* ignore */ }

        // Build ordered list: detected first, then rest alphabetically
        const detected = detectedLanguage || [...langSet][0] || "python";
        const others = [...langSet].filter(l => l !== detected).sort();
        setAvailableLanguages([detected, ...others]);
        setSelectedLanguage(detected);
      } catch (err) {
        console.error("Language detection failed:", err);
      }
    };
    detectLanguage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // --- Detect skill level from recent sessions ---
  useEffect(() => {
    const fetchUserSkillLevel = async () => {
      if (!user?.uid) return;
      try {
        let snapshot;
        try {
          const sessionsQuery = query(
            collection(db, "sessions"),
            where("userId", "==", user.uid),
            orderBy("timestamp", "desc"),
            limit(5)
          );
          snapshot = await getDocs(sessionsQuery);
        } catch {
          const simpleQuery = query(
            collection(db, "sessions"),
            where("userId", "==", user.uid)
          );
          snapshot = await getDocs(simpleQuery);
        }

        if (!snapshot.empty) {
          // Use most recent session's skill level (consistent with dashboard)
          const mostRecentSkill = snapshot.docs[0]?.data()?.stats?.skillLevel;
          if (mostRecentSkill) setUserSkillLevel(mostRecentSkill);
        }
      } catch (error) {
        console.error("Failed to fetch user skill level:", error);
      }
    };
    fetchUserSkillLevel();
  }, [user]);

  // --- Fetch initial daily quests once language is detected ---
  useEffect(() => {
    if (user?.uid && selectedLanguage) {
      fetchQuestsForLanguage(selectedLanguage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

// --- Monaco mount: attach behavioral signal trackers ---
  const handleEditorMount = (editor) => {
    editor.onDidChangeModelContent((event) => {
      const now = Date.now();
      event.changes.forEach((change) => {
        const added = change.text.length;
        const removed = change.rangeLength;

        // Paste: large block or multiline text added at once
        if (added > 20 || (added > 1 && change.text.includes("\n"))) {
          bsRef.current.totalClipboardPastes += 1;
          bsRef.current.totalPasteCharacters += added;
          bsRef.current.burstCount += 1;
        }

        // Deletion
        if (removed > 0 && added === 0) {
          bsRef.current.totalDeletions += 1;
          bsRef.current.deletionCharacters += removed;
        }

        // Single-char keystroke → track rhythm
        if (added === 1 && !change.text.includes("\n")) {
          if (lastKeyTimeRef.current !== null) {
            const interval = now - lastKeyTimeRef.current;
            if (interval < 2000) {
              bsRef.current.typingIntervals.push(interval);
              if (bsRef.current.typingIntervals.length > 200)
                bsRef.current.typingIntervals.shift();
            }
          }
          lastKeyTimeRef.current = now;
        }
      });
    });
  };

  // --- Pick a quest to solve ---
  const selectQuest = (quest) => {
    setActiveQuest(quest);
    setCode(getCodeTemplate(quest.language || selectedLanguage, quest.title, quest.task));
    startTimeRef.current = Date.now();
    lastKeyTimeRef.current = null;
    bsRef.current = {
      totalClipboardPastes: 0,
      totalPasteCharacters: 0,
      totalDeletions: 0,
      deletionCharacters: 0,
      burstCount: 0,
      typingIntervals: [],
    };
    setKeystrokes(0);
    setHintsUsed(0);
    setResult(null);
  };

  // --- Go back to quest list ---
  const backToList = () => {
    setActiveQuest(null);
    setResult(null);
    setCode("");
  };

  const handleEditorChange = (value) => {
    setCode(value || "");
    setKeystrokes(prev => prev + 1);
  };

  // --- Submit solution ---
  const handleSubmit = async () => {
    if (!code.trim() || !user || !activeQuest) return;
    setSubmitting(true);
    setResult(null);

    const duration = (Date.now() - startTimeRef.current) / 1000;

    let analysis = null;
    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          code: code,
          language: selectedLanguage,
          fileName: `${activeQuest.title}.${getFileExtension(selectedLanguage)}`,
          duration: duration,
          keystrokes: keystrokes,
          questId: activeQuest.id,
          behavioralSignals: { ...bsRef.current },
        })
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      analysis = await response.json();
    } catch (err) {
      console.error("Backend analysis failed:", err);
      setSubmitting(false);
      setResult({
        success: false,
        message: "Failed to submit solution. Make sure the backend server is running."
      });
      return;
    }

    const solutionPassed = analysis.stats?.passed ?? false;
    const testsPassed = analysis.stats?.testsPassed ?? 0;
    const testsTotal = analysis.stats?.testsTotal ?? 0;
    const validationMessage = analysis.stats?.validationMessage || "";
    const validationDetails = analysis.stats?.validationDetails || [];

    // Award XP if passed
    let xpAwarded = false;
    if (solutionPassed) {
      try {
        const profileRef = doc(db, "userProfiles", user.uid);
        const profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) {
          await setDoc(profileRef, {
            userId: user.uid,
            email: user.email,
            totalXP: activeQuest.xp,
            questsCompleted: 1,
            streak: 1,
            badges: [],
            lastQuestDate: serverTimestamp(),
            createdAt: serverTimestamp()
          });
        } else {
          await updateDoc(profileRef, {
            totalXP: increment(activeQuest.xp),
            questsCompleted: increment(1),
            lastQuestDate: serverTimestamp()
          });
        }
        xpAwarded = true;
      } catch (err) {
        console.error("Failed to update XP:", err);
      }
    }

    let message = "";
    if (!solutionPassed) {
      message = `Solution failed: ${validationMessage}`;
      if (validationDetails.length > 0) message += ` (${validationDetails[0]})`;
    } else if (!xpAwarded) {
      message = "Solution passed but XP update failed.";
    } else if (analysis.stats?.aiProbability > 70) {
      message = "High AI detection - Try writing the code yourself!";
    } else {
      message = "Great job! Solution accepted!";
    }

    setResult({
      success: solutionPassed,
      passed: solutionPassed,
      testsPassed, testsTotal,
      skillLevel: analysis.stats?.skillLevel || "Unknown",
      confidence: analysis.stats?.confidence ?? 0,
      aiProbability: analysis.stats?.aiProbability ?? 0,
      xpEarned: xpAwarded ? activeQuest.xp : 0,
      message,
      aiDetection: analysis.stats?.aiDetection || null
    });

    // Report completion for difficulty scaling
    if (solutionPassed && activeQuest.id && user?.uid) {
      try {
        await fetch(`${API_BASE_URL}/quests/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            questId: activeQuest.id,
            completionTimeMs: Math.round(duration * 1000),
            estimatedTimeMs: 600000,
            hintsUsed,
            passed: true,
            questType: activeQuest.questType || "reinforcement",
          }),
        });
      } catch (err) {
        console.error("Failed to report quest completion:", err);
      }
    }

    setSubmitting(false);
  };

  const langName = selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1);
  const monacoId = getMonacoId(selectedLanguage);

  // ==================== QUEST SOLVING VIEW ====================
  if (activeQuest) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-8">
        {/* Top bar */}
        <div className="flex justify-between items-center">
          <button onClick={backToList} className="text-slate-400 hover:text-white flex items-center gap-2 transition">
            <ArrowLeft size={20} /> Back to Quests
          </button>
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-sm">{langName}</span>
            <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 px-4 py-2 rounded-full border border-indigo-500/30">
              <span className="text-indigo-400 font-semibold">Level: {userSkillLevel}</span>
            </div>
          </div>
        </div>

        {/* Quest Header */}
        <div className="bg-slate-800 border-2 border-indigo-500/50 rounded-2xl p-6 shadow-2xl">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <Code2 className="text-indigo-400" size={28} />
              <div>
                <h2 className="text-2xl font-bold text-white">{activeQuest.title}</h2>
                <p className="text-slate-400 text-sm mt-1">{langName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-yellow-400 bg-yellow-400/10 px-4 py-2 rounded-full border border-yellow-400/20">
              <Trophy size={20} />
              <span className="font-bold">{activeQuest.xp} XP</span>
            </div>
          </div>
          <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-700/50">
            <div className="flex items-start gap-3">
              <Sparkles className="text-indigo-400 mt-1 flex-shrink-0" size={20} />
              <div>
                <h3 className="text-indigo-300 font-semibold mb-2 uppercase text-sm tracking-wide">Mission Objective</h3>
                <p className="text-slate-200 text-lg leading-relaxed">{activeQuest.task}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-slate-900 px-6 py-3 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="text-green-400" size={18} />
              <span className="text-slate-300 font-semibold">Code Editor</span>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">{langName}</span>
            </div>
            <div className="text-xs text-slate-500">
              Keystrokes: <span className="text-indigo-400 font-mono">{keystrokes}</span>
            </div>
          </div>
          <Editor
            height="400px"
            language={monacoId}
            theme="vs-dark"
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: "on"
            }}
          />
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`border-2 rounded-2xl p-6 ${
                result.success ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"
              }`}
            >
              <div className="flex items-start gap-4">
                {result.success ? (
                  <CheckCircle className="text-green-400 flex-shrink-0" size={28} />
                ) : (
                  <XCircle className="text-red-400 flex-shrink-0" size={28} />
                )}
                <div className="flex-1">
                  <h3 className={`text-xl font-bold mb-2 ${result.success ? "text-green-400" : "text-red-400"}`}>
                    {result.success ? "Quest Completed!" : "Solution Incorrect"}
                  </h3>
                  <p className="text-slate-200 mb-4">{result.message}</p>

                  {result.testsTotal > 0 && (
                    <div className="mb-4 bg-slate-800/50 p-3 rounded-lg inline-block">
                      <p className="text-xs text-slate-400">Tests Passed</p>
                      <p className={`text-lg font-bold ${result.success ? "text-green-400" : "text-red-400"}`}>
                        {result.testsPassed} / {result.testsTotal}
                      </p>
                    </div>
                  )}

                  {/* Model Analysis — always shown */}
                  {(result.skillLevel || result.aiDetection) && (
                    <div className="mt-4 space-y-4">
                      <div className={`grid gap-4 mt-2 ${result.success ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3"}`}>
                        <div className="bg-slate-800/50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400">Detected Skill</p>
                          <p className="text-lg font-bold text-indigo-400">{result.skillLevel || "—"}</p>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400">Confidence</p>
                          <p className="text-lg font-bold text-blue-400">{(result.confidence || 0).toFixed(1)}%</p>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400">AI Detection</p>
                          <p className={`text-lg font-bold ${(result.aiProbability || 0) > 70 ? "text-red-400" : (result.aiProbability || 0) > 40 ? "text-yellow-400" : "text-green-400"}`}>
                            {(result.aiProbability || 0).toFixed(1)}%
                          </p>
                        </div>
                        {result.success && (
                          <div className="bg-slate-800/50 p-3 rounded-lg">
                            <p className="text-xs text-slate-400">XP Earned</p>
                            <p className="text-lg font-bold text-yellow-400">+{result.xpEarned}</p>
                          </div>
                        )}
                      </div>

                      {/* AI Detection Signal Breakdown */}
                      {result.aiDetection?.signals && (
                        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5">
                          <div className="flex items-center gap-2 mb-4">
                            {(result.aiProbability || 0) > 50 ? (
                              <ShieldAlert className="text-red-400" size={20} />
                            ) : (
                              <ShieldCheck className="text-green-400" size={20} />
                            )}
                            <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
                              AI Detection Breakdown
                            </h4>
                            <span className="ml-auto text-xs text-slate-500">
                              Confidence: {result.aiDetection.confidence}%
                            </span>
                          </div>
                          <div className="space-y-3">
                            {Object.entries(result.aiDetection.signals).map(([key, signal]) => (
                              <div key={key} className="flex items-center gap-3">
                                <div className="w-32 text-xs text-slate-400 flex-shrink-0">{signal.name}</div>
                                <div className="flex-1">
                                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        signal.verdict === "ai_likely" ? "bg-red-500" :
                                        signal.verdict === "suspicious" ? "bg-yellow-500" : "bg-green-500"
                                      }`}
                                      style={{ width: `${Math.min(signal.score, 100)}%` }}
                                    />
                                  </div>
                                </div>
                                <span className={`text-xs font-mono w-10 text-right ${
                                  signal.verdict === "ai_likely" ? "text-red-400" :
                                  signal.verdict === "suspicious" ? "text-yellow-400" : "text-green-400"
                                }`}>
                                  {signal.score}
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                  signal.verdict === "ai_likely" ? "bg-red-500/20 text-red-400" :
                                  signal.verdict === "suspicious" ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
                                }`}>
                                  {signal.verdict === "ai_likely" ? "AI" : signal.verdict === "suspicious" ? "SUS" : "OK"}
                                </span>
                              </div>
                            ))}
                          </div>
                          {result.aiDetection.recommendation && (
                            <p className="mt-4 text-xs text-slate-500 italic border-t border-slate-700/50 pt-3">
                              {result.aiDetection.recommendation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={backToList}
            disabled={submitting}
            className="py-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft size={20} />
            Back to Quest List
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !code.trim()}
            className="py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Zap size={20} fill="currentColor" />
                Submit Solution
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ==================== QUEST LIST VIEW ====================
  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <button onClick={() => navigate("/user/dashboard")} className="text-slate-400 hover:text-white flex items-center gap-2 transition">
          <ChevronLeft size={20} /> Back to Dashboard
        </button>
        <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 px-4 py-2 rounded-full border border-indigo-500/30">
          <span className="text-indigo-400 font-semibold">Level: {userSkillLevel}</span>
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-white flex items-center justify-center gap-3">
          <Brain className="text-indigo-400" size={40} /> Daily Quests
        </h1>
        <p className="text-slate-400 mt-2">
          {dailyMeta ? (
            <>
              Personalized for your <span className="text-indigo-400 font-semibold">{dailyMeta.skillLevel}</span> level in{" "}
              <span className="text-indigo-400 font-semibold capitalize">{dailyMeta.language}</span>.
              {dailyMeta.cached && <span className="ml-2 text-xs text-slate-500">(today&apos;s quests)</span>}
            </>
          ) : (
            <>Your personalized coding challenges for today.</>
          )}
        </p>
      </div>

      {/* Language Tabs */}
      {availableLanguages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableLanguages.map((lang) => (
            <button
              key={lang}
              onClick={() => fetchQuestsForLanguage(lang)}
              className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
                selectedLanguage === lang
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                  : "bg-slate-800 text-slate-400 border border-slate-700 hover:border-indigo-500/50 hover:text-slate-200"
              }`}
            >
              {lang === detectedLanguage ? `★ ${lang}` : lang}
            </button>
          ))}
        </div>
      )}

      {/* Quest Grid */}
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-slate-500">Loading {langName} quests...</p>
        </div>
      ) : error ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-8 text-center"
        >
          <AlertTriangle className="text-red-400 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold text-red-400 mb-2">Connection Error</h2>
          <p className="text-slate-300 mb-6">{error}</p>
        </motion.div>
      ) : quests.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/40 border border-slate-700 rounded-2xl">
          <Code2 size={48} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-lg font-semibold text-slate-400 mb-2">No quests available</h3>
          <p className="text-slate-500">No {langName} quests found for {userSkillLevel} level.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-sm">
              {quests.length} personalized quest{quests.length !== 1 ? "s" : ""} for today
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quests.map((quest, index) => (
              <motion.div
                key={`${quest.id || "quest"}_${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => selectQuest(quest)}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-6 cursor-pointer hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all group"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                      <Code2 className="text-indigo-400" size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition">{quest.title}</h3>
                      {quest.questType && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          quest.questType === "stretch" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                          quest.questType === "weak_area" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                          "bg-green-500/20 text-green-400 border border-green-500/30"
                        }`}>
                          {quest.questType === "stretch" ? "Stretch" : quest.questType === "weak_area" ? "Weak Area" : "Reinforce"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full text-sm font-bold">
                    <Star size={14} fill="currentColor" />
                    {quest.xp} XP
                  </div>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">{quest.task}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{langName}</span>
                    {(quest.testCasesCount ?? quest.testCases?.length ?? 0) > 0 && (
                      <>
                        <span className="text-slate-700">|</span>
                        <span>{quest.testCasesCount ?? quest.testCases?.length} test{(quest.testCasesCount ?? quest.testCases?.length) !== 1 ? "s" : ""}</span>
                      </>
                    )}
                  </div>
                  <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition font-semibold">
                    Start Quest &rarr;
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Quests;
