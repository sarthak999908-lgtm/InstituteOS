import { getStudents, createStudent, deleteStudent } from "./api.js";

export const studentsService = {
  async getAll() {
    const data = await getStudents();
    if (!Array.isArray(data)) throw new Error("Student API returned an invalid response.");
    return data.map((student) => ({
      ...student,
      course: student.course || student.course_name || "",
      batch: student.batch_name || student.batch || "",
      joined_on: student.joined_on || student.created_at?.slice(0, 10),
    }));
  },

  async save(student) {
    if (!student.name || !student.name.trim()) throw new Error("Student name is required.");
    return createStudent({ ...student, updated_at: new Date().toISOString() });
  },

  async remove(studentId) {
    if (!studentId) throw new Error("A student ID is required.");
    return deleteStudent(studentId);
  },

  paginate(items, page = 1, pageSize = 10) {
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const start = (currentPage - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize), total, page: currentPage, pageSize, totalPages,
      hasNext: currentPage < totalPages, hasPrev: currentPage > 1,
    };
  },
};
