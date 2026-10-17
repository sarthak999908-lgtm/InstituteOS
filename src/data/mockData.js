function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const weekdays = [1, 2, 3, 4, 5, 6, 0];

export const users = [
  { id: "USR-OWNER", name: "Aditi Rao", role: "owner", email: "owner@techsummittrainers.in" },
  { id: "USR-COUNSELOR", name: "Kabir Shah", role: "counselor", email: "counselor@techsummittrainers.in" },
  { id: "USR-TRAINER", name: "Anil Verma", role: "trainer", email: "anil@techsummittrainers.in" },
  { id: "USR-ACCOUNTS", name: "Meera Iyer", role: "accounts", email: "accounts@techsummittrainers.in" },
];

// Explicit immutable identity links for the local demo fixtures. Remote trainer
// authorization uses public.trainers.auth_user_id in the tenant migration.
export const trainerIdByUserId = Object.freeze({ "USR-TRAINER": "TR-ANIL" });

export const courses = [
  { id: "COURSE-JAVA", name: "Java Full Stack", fee_total: 48000, duration_weeks: 24 },
  { id: "COURSE-PYTHON", name: "Python and Data Science", fee_total: 52000, duration_weeks: 26 },
  { id: "COURSE-DEVOPS", name: "DevOps", fee_total: 44000, duration_weeks: 20 },
  { id: "COURSE-TESTING", name: "Software Testing", fee_total: 36000, duration_weeks: 18 },
  { id: "COURSE-UX", name: "UI/UX Design", fee_total: 40000, duration_weeks: 20 },
];

export const trainers = [
  { id: "TR-ANIL", name: "Anil Verma", skills: "Java, Spring Boot", weekly_hours_max: 24 },
  { id: "TR-NEHA", name: "Neha Kapoor", skills: "React, Node.js", weekly_hours_max: 24 },
  { id: "TR-ARJUN", name: "Arjun Mehta", skills: "Python, Machine Learning", weekly_hours_max: 20 },
  { id: "TR-MIRA", name: "Mira Shah", skills: "UI/UX, Figma", weekly_hours_max: 20 },
  { id: "TR-DEV", name: "Dev Malhotra", skills: "Docker, Kubernetes", weekly_hours_max: 22 },
  { id: "TR-PRIYA", name: "Priya Nair", skills: "QA, Automation", weekly_hours_max: 22 },
  { id: "TR-ROHAN", name: "Rohan Das", skills: "Cloud, AWS", weekly_hours_max: 20 },
  { id: "TR-SANA", name: "Sana Qureshi", skills: "Data Analytics, SQL", weekly_hours_max: 20 },
];

export const rooms = [
  { id: "ROOM-1", name: "Room 1", capacity: 32 },
  { id: "ROOM-2", name: "Room 2", capacity: 28 },
  { id: "ROOM-3", name: "Lab 1", capacity: 24 },
  { id: "ROOM-4", name: "Lab 2", capacity: 36 },
];

export const batches = Array.from({ length: 12 }, (_, index) => {
  const course = courses[index % courses.length];
  const trainer = trainers[index % trainers.length];
  const room = rooms[index % rooms.length];
  const name = index === 0
    ? "Java-A"
    : `${course.name.split(" ")[0]}-${String.fromCharCode(65 + Math.floor(index / courses.length))}`;
  return {
    id: index === 0 ? "BATCH-JAVA-A" : `BATCH-${String(index + 1).padStart(2, "0")}`,
    course_id: course.id,
    trainer_id: trainer.id,
    name,
    mode: index % 3 === 0 ? "hybrid" : "classroom",
    start_date: dateOffset(-56 + index),
    slot_days: JSON.stringify([weekdays[(index + 1) % 7], weekdays[(index + 4) % 7]]),
    slot_start: index % 2 ? "14:00" : "10:00",
    slot_end: index % 2 ? "16:00" : "12:00",
    room_id: room.id,
    online_seat_limit: 20,
    weekly_sessions: 2,
    duration_hours: 2,
    student_count: index === 0 ? 12 : 11 + (index % 4),
    course_name: course.name,
    trainer_name: trainer.name,
  };
});

export const trainerAvailability = trainers.flatMap((trainer) =>
  [1, 2, 3, 4, 5, 6].map((weekday) => ({
    trainer_id: trainer.id,
    weekday,
    start: "09:00",
    end: "19:00",
  }))
);

export const students = Array.from({ length: 140 }, (_, index) => {
  const batch = batches[index < 12 ? 0 : 1 + ((index - 12) % 11)];
  const firstNames = ["Aarav", "Ananya", "Rohan", "Priya", "Ishaan", "Kavya", "Vihaan", "Diya", "Arjun", "Meera", "Kabir", "Sana", "Aditya", "Tara"];
  const lastNames = ["Sharma", "Patel", "Verma", "Singh", "Gupta", "Rao", "Nair", "Mehta", "Das", "Kapoor"];
  const name = `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length) % lastNames.length]}`;
  return {
    id: `STU-${String(index + 1).padStart(3, "0")}`,
    name,
    phone: `98765${String(43210 + index).slice(-5)}`,
    email: `student${index + 1}@example.com`,
    batch_id: batch.id,
    status: index % 19 === 0 ? "inactive" : "active",
    joined_on: dateOffset(-90 + index % 50),
    course_id: batch.course_id,
    batch_name: batch.name,
  };
});

export const sessions = batches.flatMap((batch, batchIndex) =>
  Array.from({ length: 12 }, (_, week) => {
    const date = dateOffset(-(42 - week * 7 + (batchIndex % 3)));
    const start = batch.slot_start;
    return {
      id: `SES-${batch.id}-${String(week + 1).padStart(2, "0")}`,
      batch_id: batch.id,
      date,
      start,
      end: batch.slot_end,
    };
  })
);

const javaStudents = students.filter((student) => student.batch_id === "BATCH-JAVA-A");
export const attendance = sessions.flatMap((session, sessionIndex) => {
  const batchStudents = students.filter((student) => student.batch_id === session.batch_id);
  return batchStudents.map((student, studentIndex) => {
    const guaranteedMiss = session.batch_id === "BATCH-JAVA-A" && studentIndex < 5 && sessionIndex % 3 === 0;
    const absent = guaranteedMiss || (studentIndex + sessionIndex) % 13 === 0;
    const mode = studentIndex % 3 === 0 ? "online" : "classroom";
    return {
      id: `ATT-${session.id}-${student.id}`,
      student_id: student.id,
      session_id: session.id,
      mode,
      checkin_at: absent || mode === "online" ? null : `${session.date}T${session.start}:00`,
      join_at: absent || mode !== "online" ? null : `${session.date}T${session.start}:00`,
      leave_at: absent || mode !== "online" ? null : `${session.date}T${session.end}:00`,
      status: absent ? "absent" : (studentIndex + sessionIndex) % 17 === 0 ? "late" : "present",
    };
  });
});

export const assignments = batches.map((batch, index) => ({
  id: `ASG-${index + 1}`,
  batch_id: batch.id,
  title: `${batch.course_name} capstone ${index + 1}`,
  due: dateOffset(7 + index),
}));

export const submissions = students.map((student, index) => ({
  id: `SUB-${index + 1}`,
  assignment_id: assignments.find((assignment) => assignment.batch_id === student.batch_id).id,
  student_id: student.id,
  submitted_at: index % 8 === 0 ? null : dateOffset(-index % 12),
  score: index % 8 === 0 ? null : 65 + (index % 36),
}));

export const feePlans = students.map((student) => ({
  id: `PLAN-${student.id}`,
  student_id: student.id,
  total: courses.find((course) => course.id === student.course_id).fee_total,
  plan_type: "emi",
}));

export const instalments = students.flatMap((student, studentIndex) =>
  Array.from({ length: 4 }, (_, index) => {
    const javaReminderDue = student.batch_id === "BATCH-JAVA-A" && studentIndex < 5 && index === 2;
    const dueInDays = javaReminderDue ? 1 + (studentIndex % 2) : index === 0 ? -18 - studentIndex % 9 : index === 1 ? 2 + studentIndex % 6 : 20 + index;
    const amount = Math.round(feePlans[studentIndex].total / 4);
    const paid = index === 0 || (studentIndex + index) % 5 === 0;
    return {
      id: `EMI-${student.id}-${index + 1}`,
      student_id: student.id,
      due_date: dateOffset(dueInDays),
      amount,
      paid_amount: paid ? amount : 0,
      paid_on: paid ? dateOffset(-Math.max(0, -dueInDays)) : null,
      status: paid ? "paid" : dueInDays < 0 ? "overdue" : "due",
    };
  })
);

export const payments = instalments.filter((item) => item.status === "paid").map((item, index) => ({
  id: `PAY-${index + 1}`,
  student_id: item.student_id,
  instalment_id: item.id,
  amount: item.paid_amount,
  method: index % 2 ? "UPI" : "Bank transfer",
  utr: `UTR${String(100000 + index)}`,
  received_on: item.paid_on,
}));

export const recordings = sessions.filter((_, index) => index % 2 === 0).map((session, index) => ({
  id: `REC-${index + 1}`,
  session_id: session.id,
  url: `https://example.com/recordings/${session.id}`,
  duration_min: 85 + (index % 35),
}));

export const dataSeed = {
  users,
  courses,
  trainers,
  trainer_availability: trainerAvailability,
  rooms,
  batches,
  students,
  attendance,
  sessions,
  assignments,
  submissions,
  fee_plans: feePlans,
  instalments,
  payments,
  recordings,
  approvals: [],
  audit_log: [],
};

export const javaRiskStudentIds = javaStudents.slice(0, 5).map((student) => student.id);
