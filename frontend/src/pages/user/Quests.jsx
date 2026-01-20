import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { Brain, Trophy, Zap, ChevronLeft, Code2, Sparkles, Play, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import { db } from "../../firebase/config";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";

const Quests = () => {
  const [quest, setQuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("# Write your solution here\n");
  const [userSkillLevel, setUserSkillLevel] = useState("Beginner");
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

  // Fetch quest based on user's skill level
  useEffect(() => {
    const fetchQuest = async () => {
      try {
        const response = await fetch(`http://localhost:8000/get-quest/${userSkillLevel}`);
        const data = await response.json();
        setQuest(data);
        // Reset code editor with default template
        setCode(`# ${data.title}\n# Task: ${data.task}\n\n# Write your solution here:\n`);
        startTimeRef.current = Date.now();
        setKeystrokes(0);
        setResult(null);
      } catch (error) {
        console.error("Failed to fetch quest:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userSkillLevel) {
      fetchQuest();
    }
  }, [userSkillLevel]);

  // Track keystrokes for AI detection
  const handleEditorChange = (value) => {
    setCode(value || "");
    setKeystrokes(prev => prev + 1);
  };

  // Skip to next quest
  const handleSkipQuest = () => {
    setLoading(true);
    const fetchQuest = async () => {
      try {
        const response = await fetch(`http://localhost:8000/get-quest/${userSkillLevel}`);
        const data = await response.json();
        setQuest(data);
        setCode(`# ${data.title}\n# Task: ${data.task}\n\n# Write your solution here:\n`);
        startTimeRef.current = Date.now();
        setKeystrokes(0);
        setResult(null);
      } catch (error) {
        console.error("Failed to fetch quest:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuest();
  };

  // Submit solution for analysis
  const handleSubmit = async () => {
    if (!code.trim() || !user) return;

    setSubmitting(true);
    setResult(null);

    try {
      const duration = (Date.now() - startTimeRef.current) / 1000; // seconds

      // Submit to backend for analysis
      const response = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          code: code,
          language: "python",
          fileName: `${quest.title}.py`,
          duration: duration,
          keystrokes: keystrokes
        })
      });

      const analysis = await response.json();

      // Award XP - Update user profile in Firestore
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

      // Show results
      setResult({
        success: true,
        skillLevel: analysis.stats.skillLevel,
        confidence: analysis.stats.confidence,
        aiProbability: analysis.stats.aiProbability,
        xpEarned: quest.xp,
        message: analysis.stats.aiProbability > 70
          ? "⚠️ High AI detection - Try writing the code yourself!"
          : "Great job! Keep practicing to improve your skills."
      });

      console.log("Analysis result:", analysis);
      console.log(`Awarded ${quest.xp} XP!`);
    } catch (error) {
      console.error("Submission failed:", error);
      setResult({
        success: false,
        message: "Failed to submit solution. Please try again."
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-8">
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate("/user/dashboard")}
          className="text-slate-400 hover:text-white flex items-center gap-2 transition"
        >
          <ChevronLeft size={20} /> Back to Dashboard
        </button>
        <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 px-4 py-2 rounded-full border border-indigo-500/30">
          <span className="text-indigo-400 font-semibold">Current Level: {userSkillLevel}</span>
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-white flex items-center justify-center gap-3">
          <Brain className="text-indigo-400" size={40} /> Skill-Up Playground
        </h1>
        <p className="text-slate-400 mt-2">Challenge yourself with personalized quests based on your skill level.</p>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
          <p className="text-slate-500">Generating your next challenge...</p>
        </div>
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
                  <p className="text-indigo-400 text-sm">Quest ID: #{quest.id}</p>
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
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">Python</span>
              </div>
              <div className="text-xs text-slate-500">
                Keystrokes: <span className="text-indigo-400 font-mono">{keystrokes}</span>
              </div>
            </div>
            <Editor
              height="400px"
              defaultLanguage="python"
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
                      {result.success ? "Quest Completed!" : "Submission Failed"}
                    </h3>
                    <p className="text-slate-200 mb-4">{result.message}</p>

                    {result.success && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="bg-slate-800/50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400">Detected Skill</p>
                          <p className="text-lg font-bold text-indigo-400">{result.skillLevel}</p>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400">Confidence</p>
                          <p className="text-lg font-bold text-blue-400">{result.confidence.toFixed(1)}%</p>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-lg">
                          <p className="text-xs text-slate-400">AI Detection</p>
                          <p className={`text-lg font-bold ${result.aiProbability > 70 ? "text-red-400" : "text-green-400"}`}>
                            {result.aiProbability.toFixed(1)}%
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