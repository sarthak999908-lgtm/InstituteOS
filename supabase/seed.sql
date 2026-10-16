-- ==============================================================================
-- InstituteOS — Complete Supabase PostgreSQL Seed Dataset
-- ==============================================================================

-- 1. Seed System Users & Roles
insert into public.users (id, name, role, email) values
  ('USR-OWNER', 'Aditi Rao', 'owner', 'owner@techsummittrainers.in'),
  ('USR-COUNSELOR', 'Kabir Shah', 'counselor', 'counselor@techsummittrainers.in'),
  ('USR-TRAINER', 'Anil Verma', 'trainer', 'anil@techsummittrainers.in'),
  ('USR-ACCOUNTS', 'Meera Iyer', 'accounts', 'accounts@techsummittrainers.in')
on conflict (id) do update set name = excluded.name, role = excluded.role, email = excluded.email;

-- 2. Seed Courses
insert into public.courses (id, name, fee_total, duration_weeks) values
  ('COURSE-JAVA', 'Java Full Stack Development', 48000, 24),
  ('COURSE-PYTHON', 'Python and Data Science', 52000, 26),
  ('COURSE-DEVOPS', 'DevOps & Cloud Engineering', 44000, 20),
  ('COURSE-TESTING', 'Full Stack Software Testing', 36000, 18),
  ('COURSE-UX', 'UI/UX Product Design', 40000, 20)
on conflict (id) do update set name = excluded.name, fee_total = excluded.fee_total;

-- 3. Seed Trainers
insert into public.trainers (id, name, skills, weekly_hours_max) values
  ('TR-ANIL', 'Anil Verma', 'Java, Spring Boot, Microservices', 24),
  ('TR-NEHA', 'Neha Kapoor', 'React, Next.js, Node.js', 24),
  ('TR-ARJUN', 'Arjun Mehta', 'Python, Machine Learning, PyTorch', 20),
  ('TR-MIRA', 'Mira Shah', 'Figma, Design Systems, Prototyping', 20),
  ('TR-DEV', 'Dev Malhotra', 'Docker, Kubernetes, AWS', 22),
  ('TR-PRIYA', 'Priya Nair', 'QA Automation, Playwright, Selenium', 22),
  ('TR-ROHAN', 'Rohan Das', 'AWS, Azure, Terraform', 20),
  ('TR-SANA', 'Sana Qureshi', 'SQL, Tableau, Data Analytics', 20)
on conflict (id) do update set name = excluded.name, skills = excluded.skills;

-- 4. Seed Rooms
insert into public.rooms (id, name, capacity) values
  ('ROOM-1', 'Lecture Hall 1', 32),
  ('ROOM-2', 'Lecture Hall 2', 28),
  ('ROOM-3', 'High-Performance Lab 1', 24),
  ('ROOM-4', 'Studio Lab 2', 36)
on conflict (id) do update set name = excluded.name, capacity = excluded.capacity;

-- 5. Seed Batches
insert into public.batches (id, course_id, trainer_id, name, mode, start_date, slot_days, slot_start, slot_end, room_id, online_seat_limit, student_count, course_name, trainer_name) values
  ('BATCH-JAVA-A', 'COURSE-JAVA', 'TR-ANIL', 'Java-A · Morning', 'classroom', '2026-08-15', '[1, 3, 5]', '09:00', '11:00', 'ROOM-3', 20, 24, 'Java Full Stack Development', 'Anil Verma'),
  ('BATCH-02', 'COURSE-PYTHON', 'TR-ARJUN', 'Python-A · Evening', 'hybrid', '2026-08-20', '[2, 4]', '14:00', '16:00', 'ROOM-4', 25, 22, 'Python and Data Science', 'Arjun Mehta'),
  ('BATCH-03', 'COURSE-UX', 'TR-MIRA', 'Design-A · Weekend', 'classroom', '2026-09-01', '[6, 0]', '10:00', '13:00', 'ROOM-2', 15, 18, 'UI/UX Product Design', 'Mira Shah'),
  ('BATCH-04', 'COURSE-DEVOPS', 'TR-DEV', 'DevOps-A · Morning', 'online', '2026-09-10', '[1, 4]', '11:30', '13:30', 'ROOM-1', 40, 26, 'DevOps & Cloud Engineering', 'Dev Malhotra'),
  ('BATCH-05', 'COURSE-TESTING', 'TR-PRIYA', 'QA-A · Evening', 'classroom', '2026-09-15', '[2, 5]', '16:30', '18:30', 'ROOM-3', 20, 19, 'Full Stack Software Testing', 'Priya Nair'),
  ('BATCH-06', 'COURSE-JAVA', 'TR-NEHA', 'React-B · Morning', 'classroom', '2026-10-01', '[1, 3]', '09:00', '11:00', 'ROOM-4', 20, 25, 'Java Full Stack Development', 'Neha Kapoor')
on conflict (id) do update set name = excluded.name, student_count = excluded.student_count;

-- 6. Seed Students
insert into public.students (id, name, phone, email, batch_id, status, joined_on, course_id, batch_name) values
  ('STU-001', 'Aarav Sharma', '+91 98765 43210', 'aarav.sharma@example.com', 'BATCH-JAVA-A', 'Active', '2026-08-10', 'COURSE-JAVA', 'Java-A · Morning'),
  ('STU-002', 'Ananya Patel', '+91 98765 43211', 'ananya.patel@example.com', 'BATCH-JAVA-A', 'Active', '2026-08-11', 'COURSE-JAVA', 'Java-A · Morning'),
  ('STU-003', 'Rohan Verma', '+91 98765 43212', 'rohan.verma@example.com', 'BATCH-JAVA-A', 'Active', '2026-08-12', 'COURSE-JAVA', 'Java-A · Morning'),
  ('STU-004', 'Priya Singh', '+91 98765 43213', 'priya.singh@example.com', 'BATCH-JAVA-A', 'Active', '2026-08-12', 'COURSE-JAVA', 'Java-A · Morning'),
  ('STU-005', 'Ishaan Gupta', '+91 98765 43214', 'ishaan.gupta@example.com', 'BATCH-JAVA-A', 'Pending', '2026-08-14', 'COURSE-JAVA', 'Java-A · Morning'),
  ('STU-006', 'Kavya Rao', '+91 98765 43215', 'kavya.rao@example.com', 'BATCH-02', 'Active', '2026-08-18', 'COURSE-PYTHON', 'Python-A · Evening'),
  ('STU-007', 'Vihaan Nair', '+91 98765 43216', 'vihaan.nair@example.com', 'BATCH-02', 'Active', '2026-08-19', 'COURSE-PYTHON', 'Python-A · Evening'),
  ('STU-008', 'Diya Mehta', '+91 98765 43217', 'diya.mehta@example.com', 'BATCH-03', 'Active', '2026-08-28', 'COURSE-UX', 'Design-A · Weekend'),
  ('STU-009', 'Kabir Das', '+91 98765 43218', 'kabir.das@example.com', 'BATCH-04', 'Active', '2026-09-05', 'COURSE-DEVOPS', 'DevOps-A · Morning'),
  ('STU-010', 'Tara Kapoor', '+91 98765 43219', 'tara.kapoor@example.com', 'BATCH-05', 'Active', '2026-09-12', 'COURSE-TESTING', 'QA-A · Evening')
on conflict (id) do update set name = excluded.name, status = excluded.status;

-- 7. Seed Fee Plans & Instalments
insert into public.fee_plans (id, student_id, total, plan_type) values
  ('PLAN-STU-001', 'STU-001', 48000, 'two_instalments'),
  ('PLAN-STU-002', 'STU-002', 48000, 'full_payment'),
  ('PLAN-STU-003', 'STU-003', 48000, 'three_instalments'),
  ('PLAN-STU-004', 'STU-004', 48000, 'two_instalments'),
  ('PLAN-STU-005', 'STU-005', 48000, 'standard'),
  ('PLAN-STU-006', 'STU-006', 52000, 'standard')
on conflict (id) do update set total = excluded.total;

insert into public.instalments (id, student_id, due_date, amount, paid_amount, paid_on, status) values
  ('INST-001-A', 'STU-001', '2026-08-15', 24000, 24000, '2026-08-14', 'paid'),
  ('INST-001-B', 'STU-001', '2026-10-15', 24000, 14000, '2026-10-10', 'pending'),
  ('INST-002-A', 'STU-002', '2026-08-15', 48000, 48000, '2026-08-10', 'paid'),
  ('INST-003-A', 'STU-003', '2026-08-15', 16000, 16000, '2026-08-14', 'paid'),
  ('INST-003-B', 'STU-003', '2026-09-30', 16000, 0, null, 'overdue'),
  ('INST-003-C', 'STU-003', '2026-11-15', 16000, 0, null, 'pending'),
  ('INST-004-A', 'STU-004', '2026-08-15', 24000, 24000, '2026-08-15', 'paid'),
  ('INST-004-B', 'STU-004', '2026-10-30', 24000, 0, null, 'pending'),
  ('INST-005-A', 'STU-005', '2026-08-20', 24000, 0, null, 'overdue')
on conflict (id) do update set paid_amount = excluded.paid_amount, status = excluded.status;

-- 8. Seed Sample Payments
insert into public.payments (id, student_id, instalment_id, amount, method, utr, received_on) values
  ('PAY-1001', 'STU-001', 'INST-001-A', 24000, 'upi', 'UPI/26081498124/HDFC', '2026-08-14'),
  ('PAY-1002', 'STU-001', 'INST-001-B', 14000, 'net_banking', 'NEFT/26101088712/ICICI', '2026-10-10'),
  ('PAY-1003', 'STU-002', 'INST-002-A', 48000, 'net_banking', 'RTGS/26081022319/SBI', '2026-08-10'),
  ('PAY-1004', 'STU-003', 'INST-003-A', 16000, 'upi', 'UPI/26081433291/AXIS', '2026-08-14'),
  ('PAY-1005', 'STU-004', 'INST-004-A', 24000, 'card', 'POS/26081577182/KOTAK', '2026-08-15')
on conflict (id) do nothing;
