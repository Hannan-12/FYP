import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { Brain, Trophy, Zap, ChevronLeft, Code2, Sparkles, Play, CheckCircle, XCircle, AlertTriangle, RefreshCw, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { db } from "../../firebase/config";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";

// Backend API URL - uses environment variable in production
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Language configuration for the editor and quests
const LANGUAGES = [
  { id: "python", name: "Python", monacoId: "python", icon: "🐍" },
  { id: "javascript", name: "JavaScript", monacoId: "javascript", icon: "🟨" },
  { id: "java", name: "Java", monacoId: "java", icon: "☕" },
  { id: "csharp", name: "C#", monacoId: "csharp", icon: "🟪" },
];

// Default code templates per language
const CODE_TEMPLATES = {
  python: (title, task) => `# ${title}\n# Task: ${task}\n\n# Write your solution here:\n`,
  javascript: (title, task) => `// ${title}\n// Task: ${task}\n\n// Write your solution here:\n`,
  java: (title, task) => `// ${title}\n// Task: ${task}\n\npublic class Solution {\n    // Write your solution here:\n    \n}\n`,
  csharp: (title, task) => `// ${title}\n// Task: ${task}\n\nusing System;\n\n// Write your solution here:\n`,
};

const Quests = () => {
  const [quest, setQuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [code, setCode] = useState("# Write your solution here\n");
  const [userSkillLevel, setUserSkillLevel] = useState("Beginner");
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [keystrokes, setKeystrokes] = useState(0);
  const startTimeRef = useRef(Date.now());
  const { user } = useAuth();
  const navigate = useNavigate();

  // Detect user's actual skill level from their session history
  useEffect(() => {
    const fetchUserSkillLevel = async () => {
      if (!user?.uid) return;

      try {
        const sessionsQuery = query(
          collection(db, "sessions"),
          where("userId", "==", user.uid),
          orderBy("timestamp", "desc"),
          limit(5)
        );

        const snapshot = await getDocs(sessionsQuery);

        if (!snapshot.empty) {
          // Calculate most common skill level from last 5 sessions
          const skillCounts = { Beginner: 0, Intermediate: 0, Advanced: 0 };

          snapshot.forEach(doc => {
            const skillLevel = doc.data().stats?.skillLevel;
            if (skillLevel && skillCounts.hasOwnProperty(skillLevel)) {
              skillCounts[skillLevel]++;
            }
          });

          // Find the most common skill level
          const detectedSkill = Object.entries(skillCounts).reduce((a, b) =>
            skillCounts[a[0]] > skillCounts[b[0]] ? a : b
          )[0];

          setUserSkillLevel(detectedSkill);
          console.log("Detected user skill level:", detectedSkill);
        }
      } catch (error) {
        console.error("Failed to fetch user skill level:", error);
      }
    };

    fetchUserSkillLevel();
  }, [user]);

  // Fetch quest based on user's skill level AND selected language
  useEffect(() => {
    const fetchQuest = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE_URL}/get-quest/${userSkillLevel}?language=${selectedLanguage}`
        );
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }
        const data = await response.json();
        setQuest(data);
        // Reset code editor with language-appropriate template
        const template = CODE_TEMPLATES[selectedLanguage] || CODE_TEMPLATES.python;
        setCode(template(data.title, data.task));
        startTimeRef.current = Date.now();
        setKeystrokes(0);
        setResult(null);
      } catch (err) {
        console.error("Failed to fetch quest:", err);
        setError("Unable to connect to the backend server. Please make sure the backend is running on http://localhost:8000");
        setQuest(null);
      } finally {
        setLoading(false);
      }
    };

    if (userSkillLevel) {
      fetchQuest();
    }
  }, [userSkillLevel, selectedLanguage]);

  // Track keystrokes for AI detection
  const handleEditorChange = (value) => {
    setCode(value || "");
    setKeystrokes(prev => prev + 1);
  };

  // Handle language change
  const handleLanguageChange = (langId) => {
    setSelectedLanguage(langId);
    setResult(null);
  };

  // Skip to next quest
  const handleSkipQuest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/get-quest/${userSkillLevel}?language=${selectedLanguage}`
      );
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const data = await response.json();
      setQuest(data);
      const template = CODE_TEMPLATES[selectedLanguage] || CODE_TEMPLATES.python;
      setCode(template(data.title, data.task));
      startTimeRef.current = Date.now();
      setKeystrokes(0);
    } catch (err) {
      console.error("Failed to fetch quest:", err);
      setError("Unable to connect to the backend server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Submit solution for analysis
  const handleSubmit = async () => {
    if (!code.trim() || !user || !quest) return;

    setSubmitting(true);
    setResult(null);

    const duration = (Date.now() - startTimeRef.current) / 1000; // seconds

    // Step 1: Submit to backend for analysis and validation
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
          fileName: `${quest.title}.${getFileExtension(selectedLanguage)}`,
          duration: duration,
          keystrokes: keystrokes,
          questId: quest.id  // Send quest ID for validation
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend error response:", errorText);
        throw new Error(`Server error: ${response.status}`);
      }
      analysis = await response.json();
      console.log("Analysis result:", analysis);
    } catch (err) {
      console.error("Backend analysis failed:", err);
      setSubmitting(false);
      setResult({
        success: false,
        message: "Failed to submit solution. Please make sure the backend server is running and try again."
      });
      return;
    }

    // Check if solution passed validation
    const solutionPassed = analysis.stats?.passed ?? false;
    const testsPassed = analysis.stats?.testsPassed ?? 0;
    const testsTotal = analysis.stats?.testsTotal ?? 0;
    const validationMessage = analysis.stats?.validationMessage || "";
    const validationDetails = analysis.stats?.validationDetails || [];

    // Step 2: Award XP ONLY if solution passed validation
    let xpAwarded = false;
    if (solutionPassed) {
      try {
        const profileRef = doc(db, "userProfiles", user.uid);
        const profileSnap = await getDoc(profileRef);

        if (!profileSnap.exists()) {
          // Create new profile with XP
          await setDoc(profileRef, {
            userId: user.uid,
            email: user.email,
            totalXP: quest.xp,
            questsCompleted: 1,
            streak: 1,
            badges: [],
            lastQuestDate: serverTimestamp(),
            createdAt: serverTimestamp()
          });
        } else {
          // Update existing profile - add XP
          await updateDoc(profileRef, {
            totalXP: increment(quest.xp),
            questsCompleted: increment(1),
            lastQuestDate: serverTimestamp()
          });
        }
        xpAwarded = true;
        console.log(`Awarded ${quest.xp} XP!`);
      } catch (err) {
        console.error("Failed to update XP in Firestore:", err);
      }
    }

    // Step 3: Show results with pass/fail status
    let message = "";
    if (!solutionPassed) {
      message = `Solution failed: ${validationMessage}`;
      if (validationDetails.length > 0) {
        message += ` (${validationDetails[0]})`;
      }
    } else if (!xpAwarded) {
      message = "Solution passed but XP update failed. Your progress may not be saved.";
    } else if (analysis.stats?.aiProbability > 70) {
      message = "High AI detection - Try writing the code yourself!";
    } else {
      message = "Great job! Solution accepted! Keep practicing to improve your skills.";
    }

    setResult({
      success: solutionPassed,
      passed: solutionPassed,
      testsPassed: testsPassed,
      testsTotal: testsTotal,
      skillLevel: analysis.stats?.skillLevel || "Unknown",
      confidence: analysis.stats?.confidence ?? 0,
      aiProbability: analysis.stats?.aiProbability ?? 0,
      xpEarned: xpAwarded ? quest.xp : 0,
      message: message
    });

    setSubmitting(false);
  };

  // Get file extension for language
  const getFileExtension = (lang) => {
    const extensions = { python: "py", javascript: "js", java: "java", csharp: "cs" };
    return extensions[lang] || "txt";
  };

  // Get current language config
  const currentLang = LANGUAGES.find(l => l.id === selectedLanguage) || LANGUAGES[0];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-8">
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate("/user/dashboard")}
          className="text-slate-400 hover:text-white flex items-center gap-2 transition"
        >
          <ChevronLeft size={20} /> Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 px-4 py-2 rounded-full border border-indigo-500/30">
            <span className="text-indigo-400 font-semibold">Level: {userSkillLevel}</span>
          </div>
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-white flex items-center justify-center gap-3">
          <Brain className="text-indigo-400" size={40} /> Skill-Up Playground
        </h1>
        <p className="text-slate-400 mt-2">Challenge yourself with personalized quests based on your skill level and language.</p>
      </div>

      {/* Language Selector */}
      <div className="flex items-center justify-center gap-3">
        <Globe className="text-slate-400" size={18} />
        <span className="text-slate-400 text-sm font-medium">Language:</span>
        <div className="flex gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              onClick={() => handleLanguageChange(lang.id)}
              disabled={loading || submitting}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                selectedLanguage === lang.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
              } disabled:opacity-50`}
            >
              <span>{lang.icon}</span>
              {lang.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-slate-500">Generating your next {currentLang.name} challenge...</p>
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
          <button
            onClick={handleSkipQuest}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 mx-auto transition-all"
          >
            <RefreshCw size={20} />
            Try Again
          </button>
        </motion.div>
      ) : quest && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Quest Header */}
          <div className="bg-slate-800 border-2 border-indigo-500/50 rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <Code2 className="text-indigo-400" size={28} />
                <div>
                  <h2 className="text-2xl font-bold text-white">{quest.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-indigo-400 text-sm">Quest #{quest.id}</p>
                    <span className="text-slate-600">|</span>
                    <p className="text-slate-400 text-sm">{currentLang.icon} {currentLang.name}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-yellow-400 bg-yellow-400/10 px-4 py-2 rounded-full border border-yellow-400/20">
                <Trophy size={20} />
                <span className="font-bold">{quest.xp} XP</span>
              </div>
            </div>

            <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-700/50">
              <div className="flex items-start gap-3">
                <Sparkles className="text-indigo-400 mt-1 flex-shrink-0" size={20} />
                <div>
                  <h3 className="text-indigo-300 font-semibold mb-2 uppercase text-sm tracking-wide">Mission Objective</h3>
                  <p className="text-slate-200 text-lg leading-relaxed">
                    {quest.task}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Code Editor */}
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
                roundedSelection: true,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: "on"
              }}
            />
          </div>

          {/* Result Display */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`border-2 rounded-2xl p-6 ${
                  result.success
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-red-500/10 border-red-500/30"
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

                    {/* Show test results for both pass and fail */}
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

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleSkipQuest}
              disabled={loading || submitting}
              className="py-4 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <ChevronLeft size={20} />
              Skip Quest
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || submitting || !code.trim()}
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
        </motion.div>
      )}
    </div>
  );
};

export default Quests;
