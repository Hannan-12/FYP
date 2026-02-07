import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { Brain, Trophy, Zap, ChevronLeft, Code2, Sparkles, Play, CheckCircle, XCircle, AlertTriangle, RefreshCw, Globe, ArrowLeft, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { db } from "../../firebase/config";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const LANGUAGES = [
  { id: "python", name: "Python", monacoId: "python", icon: "🐍" },
  { id: "javascript", name: "JavaScript", monacoId: "javascript", icon: "🟨" },
  { id: "java", name: "Java", monacoId: "java", icon: "☕" },
  { id: "csharp", name: "C#", monacoId: "csharp", icon: "🟪" },
  { id: "html", name: "HTML/CSS", monacoId: "html", icon: "🌐" },
];

const CODE_TEMPLATES = {
  python: (title, task) => `# ${title}\n# Task: ${task}\n\n# Write your solution here:\n`,
  javascript: (title, task) => `// ${title}\n// Task: ${task}\n\n// Write your solution here:\n`,
  java: (title, task) => `// ${title}\n// Task: ${task}\n\npublic class Solution {\n    // Write your solution here:\n    \n}\n`,
  csharp: (title, task) => `// ${title}\n// Task: ${task}\n\nusing System;\n\n// Write your solution here:\n`,
  html: (title, task) => `<!-- ${title} -->\n<!-- Task: ${task} -->\n\n<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>${title}</title>\n    <style>\n        /* Write your CSS here */\n    </style>\n</head>\n<body>\n    <!-- Write your HTML here -->\n    \n</body>\n</html>\n`,
};

const getFileExtension = (lang) => {
  const extensions = { python: "py", javascript: "js", java: "java", csharp: "cs", html: "html" };
  return extensions[lang] || "txt";
};

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
  const [allLangCounts, setAllLangCounts] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [keystrokes, setKeystrokes] = useState(0);
  const startTimeRef = useRef(Date.now());
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- Detect language from user's coding sessions ---
  useEffect(() => {
    const detectLanguage = async () => {
      if (!user?.uid) return;
      try {
        const response = await fetch(`${API_BASE_URL}/detect-language/${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          if (data.language) {
            setDetectedLanguage(data.language);
            setSelectedLanguage(data.language);
            setAllLangCounts(data.all || {});
          }
        }
      } catch (err) {
        console.error("Language detection failed:", err);
      }
    };
    detectLanguage();
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
          const skillCounts = { Beginner: 0, Intermediate: 0, Advanced: 0 };
          snapshot.forEach(doc => {
            const skillLevel = doc.data().stats?.skillLevel;
            if (skillLevel && skillCounts.hasOwnProperty(skillLevel)) {
              skillCounts[skillLevel]++;
            }
          });
          const detectedSkill = Object.entries(skillCounts).reduce((a, b) =>
            skillCounts[a[0]] > skillCounts[b[0]] ? a : b
          )[0];
          setUserSkillLevel(detectedSkill);
        }
      } catch (error) {
        console.error("Failed to fetch user skill level:", error);
      }
    };
    fetchUserSkillLevel();
  }, [user]);

  // --- Fetch multiple quests when language or skill level changes ---
  useEffect(() => {
    const fetchQuests = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE_URL}/get-quests/${userSkillLevel}?language=${selectedLanguage}&count=8`
        );
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const data = await response.json();
        setQuests(data.quests || []);
      } catch (err) {
        console.error("Failed to fetch quests:", err);
        setError("Unable to connect to the backend. Make sure the server is running.");
        setQuests([]);
      } finally {
        setLoading(false);
      }
    };

    if (userSkillLevel && selectedLanguage) {
      fetchQuests();
    }
  }, [userSkillLevel, selectedLanguage]);

  // --- Pick a quest to solve ---
  const selectQuest = (quest) => {
    setActiveQuest(quest);
    const template = CODE_TEMPLATES[selectedLanguage] || CODE_TEMPLATES.python;
    setCode(template(quest.title, quest.task));
    startTimeRef.current = Date.now();
    setKeystrokes(0);
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
          questId: activeQuest.id
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
      message
    });
    setSubmitting(false);
  };

  const currentLang = LANGUAGES.find(l => l.id === selectedLanguage) || LANGUAGES[0];

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
            <span className="text-slate-500 text-sm">{currentLang.icon} {currentLang.name}</span>
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
                <p className="text-slate-400 text-sm mt-1">{currentLang.icon} {currentLang.name}</p>
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
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">{currentLang.name}</span>
            </div>
            <div className="text-xs text-slate-500">
              Keystrokes: <span className="text-indigo-400 font-mono">{keystrokes}</span>
            </div>
          </div>
          <Editor
            height="400px"
            language={currentLang.monacoId}
            theme="vs-dark"
            value={code}
            onChange={handleEditorChange}
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

                  {result.success && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div className="bg-slate-800/50 p-3 rounded-lg">
                        <p className="text-xs text-slate-400">Detected Skill</p>
                        <p className="text-lg font-bold text-indigo-400">{result.skillLevel}</p>
                      </div>
                      <div className="bg-slate-800/50 p-3 rounded-lg">
                        <p className="text-xs text-slate-400">Confidence</p>
                        <p className="text-lg font-bold text-blue-400">{(result.confidence || 0).toFixed(1)}%</p>
                      </div>
                      <div className="bg-slate-800/50 p-3 rounded-lg">
                        <p className="text-xs text-slate-400">AI Detection</p>
                        <p className={`text-lg font-bold ${(result.aiProbability || 0) > 70 ? "text-red-400" : "text-green-400"}`}>
                          {(result.aiProbability || 0).toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-slate-800/50 p-3 rounded-lg">
                        <p className="text-xs text-slate-400">XP Earned</p>
                        <p className="text-lg font-bold text-yellow-400">+{result.xpEarned}</p>
                      </div>
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
          <Brain className="text-indigo-400" size={40} /> Quest Playground
        </h1>
        <p className="text-slate-400 mt-2">
          {detectedLanguage ? (
            <>We detected you've been coding in <span className="text-indigo-400 font-semibold capitalize">{detectedLanguage}</span>. Here are your quests.</>
          ) : (
            <>Pick a language and start solving quests to level up.</>
          )}
        </p>
      </div>

      {/* Language Tabs - auto-detected language is highlighted */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <Globe className="text-slate-400" size={18} />
        <div className="flex gap-2 flex-wrap justify-center">
          {LANGUAGES.map((lang) => {
            const isDetected = lang.id === detectedLanguage;
            const isSelected = lang.id === selectedLanguage;
            const count = allLangCounts[lang.id] || 0;
            return (
              <button
                key={lang.id}
                onClick={() => setSelectedLanguage(lang.id)}
                disabled={loading}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 relative ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
                } disabled:opacity-50`}
              >
                <span>{lang.icon}</span>
                {lang.name}
                {isDetected && !isSelected && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full border border-green-500/30">detected</span>
                )}
                {count > 0 && (
                  <span className="text-[10px] text-slate-500">{count} sessions</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quest Grid */}
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-slate-500">Loading {currentLang.name} quests...</p>
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
          <p className="text-slate-500">No {currentLang.name} quests found for {userSkillLevel} level.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-sm">
              Showing {quests.length} {currentLang.name} quest{quests.length !== 1 ? "s" : ""} for {userSkillLevel} level
            </p>
            <button
              onClick={() => {
                setLoading(true);
                fetch(`${API_BASE_URL}/get-quests/${userSkillLevel}?language=${selectedLanguage}&count=8`)
                  .then(r => r.json())
                  .then(data => setQuests(data.quests || []))
                  .catch(() => {})
                  .finally(() => setLoading(false));
              }}
              className="text-slate-400 hover:text-white flex items-center gap-1 text-sm transition"
            >
              <RefreshCw size={14} /> Shuffle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quests.map((quest, index) => (
              <motion.div
                key={quest.id || index}
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
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition">{quest.title}</h3>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full text-sm font-bold">
                    <Star size={14} fill="currentColor" />
                    {quest.xp} XP
                  </div>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">{quest.task}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{currentLang.icon} {currentLang.name}</span>
                    {quest.testCases && (
                      <>
                        <span className="text-slate-700">|</span>
                        <span>{quest.testCases.length} test{quest.testCases.length !== 1 ? "s" : ""}</span>
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
