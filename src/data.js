import { courses, students } from "./data/mockData.js";

const courseNames = new Map(courses.map((course) => [course.id, course.name]));

export const INITIAL_STUDENTS = students.map((student) => ({
  ...student,
  course: courseNames.get(student.course_id) || "Unassigned course",
  batch: student.batch_name,
  status: student.status === "active" ? "Active" : "Inactive",
}));
