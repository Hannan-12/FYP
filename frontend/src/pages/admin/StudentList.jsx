import { useEffect, useState } from "react";
import { db } from "../../firebase/config";
import { collection, getDocs, query, where } from "firebase/firestore";
import { User, Mail, Calendar, Shield } from "lucide-react";
import { motion } from "framer-motion";

const StudentList = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, "users"), where("role", "==", "student"));
        const querySnapshot = await getDocs(q);
        setStudents(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Student Directory</h1>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/40 backdrop-blur-md border border-slate-700 rounded-2xl overflow-hidden shadow-xl"
      >
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading directory...</div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No students registered yet.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900/50 text-slate-400 text-sm uppercase font-medium">
              <tr>
                <th className="p-4 pl-6">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {students.map((student, idx) => (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  key={student.id} 
                  className="hover:bg-slate-700/30 transition"
                >
                  <td className="p-4 pl-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <span className="font-bold text-white text-sm">{student.name?.[0] || "U"}</span>
                    </div>
                    <span className="font-medium text-slate-200">{student.name || "Unknown"}</span>
                  </td>
                  <td className="p-4 text-slate-400">
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-slate-600" />
                      {student.email}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="bg-slate-700/50 text-slate-300 px-3 py-1 rounded-full text-xs font-bold border border-slate-600 flex w-fit items-center gap-1">
                      <Shield size={12} />
                      {student.role}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-slate-600" />
                      {student.createdAt ? new Date(student.createdAt.seconds * 1000).toLocaleDateString() : "N/A"}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
};

export default StudentList;