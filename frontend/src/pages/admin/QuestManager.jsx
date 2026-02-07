import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Book, Plus, Pencil, Trash2, Save, X, RefreshCw, Search, Upload, ChevronDown } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const LANGUAGES = [
  { id: "python", name: "Python" },
  { id: "javascript", name: "JavaScript" },
  { id: "java", name: "Java" },
  { id: "csharp", name: "C#" },
  { id: "html", name: "HTML/CSS" },
];

const LEVELS = ["Beginner", "Intermediate", "Advanced"];

const TEST_TYPES = [
  { value: "code_contains", label: "Code Contains (all patterns)" },
  { value: "code_not_contains", label: "Code Not Contains" },
  { value: "code_contains_any", label: "Code Contains Any" },
  { value: "output_contains", label: "Output Contains (Python only)" },
  { value: "function_test", label: "Function Test (Python only)" },
  { value: "code_line_count", label: "Code Line Count" },
  { value: "code_count", label: "Code Pattern Count" },
];

const QuestManager = () => {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [filterLang, setFilterLang] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingQuest, setEditingQuest] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const emptyQuest = {
    title: "",
    task: "",
    xp: 50,
    language: "python",
    level: "Beginner",
    testCases: [],
  };

  const [formData, setFormData] = useState({ ...emptyQuest });

  // Fetch quests from backend
  const fetchQuests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLang) params.set("language", filterLang);
      if (filterLevel) params.set("level", filterLevel);

      const response = await fetch(`${API_BASE_URL}/admin/quests?${params}`);
      if (!response.ok) throw new Error("Failed to fetch quests");
      const data = await response.json();
      setQuests(data.quests || []);
    } catch (err) {
      console.error("Failed to fetch quests:", err);
      setMessage({ type: "error", text: "Failed to load quests. Is the backend running?" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuests();
  }, [filterLang, filterLevel]);

  // Seed quests from hardcoded data
  const handleSeed = async () => {
    setSeeding(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/quests/seed`, { method: "POST" });
      if (!response.ok) throw new Error("Seed failed");
      const data = await response.json();
      setMessage({
        type: "success",
        text: `Seeded ${data.seeded} quests (${data.skipped} already existed)`,
      });
      fetchQuests();
    } catch (err) {
      console.error("Seed error:", err);
      setMessage({ type: "error", text: "Failed to seed quests." });
    } finally {
      setSeeding(false);
    }
  };

  // Create quest
  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.task.trim()) {
      setMessage({ type: "error", text: "Title and task are required." });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/quests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Create failed");
      }
      setMessage({ type: "success", text: "Quest created successfully!" });
      setShowCreateForm(false);
      setFormData({ ...emptyQuest });
      fetchQuests();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Update quest
  const handleUpdate = async () => {
    if (!editingQuest) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/quests/${editingQuest}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("Update failed");
      setMessage({ type: "success", text: "Quest updated!" });
      setEditingQuest(null);
      setFormData({ ...emptyQuest });
      fetchQuests();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to update quest." });
    } finally {
      setSaving(false);
    }
  };

  // Delete quest
  const handleDelete = async (questId) => {
    if (!confirm("Are you sure you want to delete this quest?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/quests/${questId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed");
      setMessage({ type: "success", text: "Quest deleted." });
      fetchQuests();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete quest." });
    }
  };

  // Start editing a quest
  const startEdit = (quest) => {
    setEditingQuest(quest.id);
    setFormData({
      title: quest.title,
      task: quest.task,
      xp: quest.xp,
      language: quest.language,
      level: quest.level,
      testCases: quest.testCases || [],
    });
    setShowCreateForm(false);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingQuest(null);
    setShowCreateForm(false);
    setFormData({ ...emptyQuest });
  };

  // Add a test case to form
  const addTestCase = () => {
    setFormData({
      ...formData,
      testCases: [...formData.testCases, { type: "code_contains", expected: [] }],
    });
  };

  // Remove a test case
  const removeTestCase = (index) => {
    setFormData({
      ...formData,
      testCases: formData.testCases.filter((_, i) => i !== index),
    });
  };

  // Update a test case
  const updateTestCase = (index, field, value) => {
    const updated = [...formData.testCases];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, testCases: updated });
  };

  // Filter quests by search
  const filteredQuests = quests.filter((q) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      q.title?.toLowerCase().includes(term) ||
      q.task?.toLowerCase().includes(term)
    );
  });

  // Group quests by language
  const groupedQuests = {};
  filteredQuests.forEach((q) => {
    const lang = q.language || "unknown";
    if (!groupedQuests[lang]) groupedQuests[lang] = [];
    groupedQuests[lang].push(q);
  });

  // Auto-dismiss messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const isFormOpen = showCreateForm || editingQuest;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Book className="text-blue-400" size={32} />
            Quest Manager
          </h1>
          <p className="text-slate-400 mt-1">Create, edit, and manage quests dynamically.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition disabled:opacity-50"
          >
            <Upload size={16} />
            {seeding ? "Seeding..." : "Seed Defaults"}
          </button>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingQuest(null);
              setFormData({ ...emptyQuest });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
          >
            <Plus size={16} />
            New Quest
          </button>
        </div>
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-lg border ${
              message.type === "success"
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search quests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterLang}
          onChange={(e) => setFilterLang(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Languages</option>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button
          onClick={fetchQuests}
          className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Create/Edit Form */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-white">
                  {editingQuest ? "Edit Quest" : "Create New Quest"}
                </h2>
                <button onClick={cancelEdit} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g., Loop Logic"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Language</label>
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Level</label>
                    <select
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      {LEVELS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">XP</label>
                    <input
                      type="number"
                      value={formData.xp}
                      onChange={(e) => setFormData({ ...formData, xp: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Task Description</label>
                <textarea
                  value={formData.task}
                  onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Describe the quest task..."
                />
              </div>

              {/* Test Cases */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-slate-400">Test Cases</label>
                  <button
                    onClick={addTestCase}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Test Case
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.testCases.map((tc, i) => (
                    <div key={i} className="flex gap-2 items-start bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                      <select
                        value={tc.type}
                        onChange={(e) => updateTestCase(i, "type", e.target.value)}
                        className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none"
                      >
                        {TEST_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={Array.isArray(tc.expected) ? tc.expected.join(", ") : tc.expected || ""}
                        onChange={(e) =>
                          updateTestCase(i, "expected", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
                        }
                        className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none placeholder-slate-500"
                        placeholder="Expected values (comma-separated)"
                      />
                      {tc.type === "function_test" && (
                        <input
                          type="text"
                          value={tc.function || ""}
                          onChange={(e) => updateTestCase(i, "function", e.target.value)}
                          className="w-32 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none placeholder-slate-500"
                          placeholder="Func name"
                        />
                      )}
                      <button
                        onClick={() => removeTestCase(i)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {formData.testCases.length === 0 && (
                    <p className="text-sm text-slate-500 italic">No test cases. Add at least one to validate solutions.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={editingQuest ? handleUpdate : handleCreate}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? "Saving..." : editingQuest ? "Update Quest" : "Create Quest"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quest List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-3"></div>
          <p className="text-slate-500">Loading quests...</p>
        </div>
      ) : filteredQuests.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/40 border border-slate-700 rounded-2xl">
          <Book size={48} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-lg font-semibold text-slate-400 mb-2">No quests found</h3>
          <p className="text-slate-500 mb-4">
            {quests.length === 0
              ? 'Click "Seed Defaults" to populate quests from the built-in templates.'
              : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        Object.entries(groupedQuests).map(([lang, langQuests]) => (
          <motion.div
            key={lang}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white capitalize">
                {lang} <span className="text-slate-500 text-sm font-normal">({langQuests.length} quests)</span>
              </h2>
            </div>
            <div className="divide-y divide-slate-700/50">
              {langQuests.map((quest) => (
                <div
                  key={quest.id}
                  className="px-6 py-4 hover:bg-slate-700/20 transition flex items-center justify-between group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-white font-medium truncate">{quest.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                        quest.level === "Advanced"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : quest.level === "Intermediate"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      }`}>
                        {quest.level}
                      </span>
                      <span className="text-yellow-400 text-xs font-bold">{quest.xp} XP</span>
                      <span className="text-slate-500 text-xs">
                        {quest.testCases?.length || 0} tests
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mt-1 truncate">{quest.task}</p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition ml-4">
                    <button
                      onClick={() => startEdit(quest)}
                      className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(quest.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
};

export default QuestManager;
