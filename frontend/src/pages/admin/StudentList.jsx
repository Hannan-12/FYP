import { useEffect, useState } from "react";
import { db } from "../../firebase/config";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { User, Mail, Calendar, Shield } from "lucide-react";

const StudentList = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        // Fetch all users where role is "student"
      const q = query(
  collection(db, "users"), 
  where("role", "==", "student")
  // orderBy removed temporarily
);
        
        const querySnapshot = await getDocs(q);
        const studentData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setStudents(studentData);
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Registered Students</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading student directory...</div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No students registered yet.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
              <tr>
                <th className="p-4 border-b">Name</th>
                <th className="p-4 border-b">Email</th>
                <th className="p-4 border-b">Role</th>
                <th className="p-4 border-b">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-full">
                      <User size={18} className="text-indigo-600" />
                    </div>
                    <span className="font-medium text-gray-800">{student.name || "Unknown"}</span>
                  </td>
                  <td className="p-4 text-gray-600">
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-gray-400" />
                      {student.email}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex w-fit items-center gap-1">
                      <Shield size={12} />
                      {student.role}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-gray-400" />
                      {student.createdAt ? new Date(student.createdAt.seconds * 1000).toLocaleDateString() : "N/A"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default StudentList;