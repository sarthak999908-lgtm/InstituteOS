import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { courses, trainers, rooms, batches, students, feePlans, instalments, users } from "../src/data/mockData.js";

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function runSeed() {
  console.log("==================================================");
  console.log("   InstituteOS · Supabase Database Seed Runner   ");
  console.log("==================================================");

  if (!url || !key || !url.startsWith("http")) {
    console.warn("⚠️  Supabase credentials not configured in .env!");
    console.log("Please define VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    console.log("Example:");
    console.log("  VITE_SUPABASE_URL=https://your-project.supabase.co");
    console.log("  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...");
    process.exit(0);
  }

  const supabase = createClient(url, key);
  console.log(`📡 Connecting to Supabase at: ${url}`);

  const seedTables = [
    { name: "courses", data: courses.map(c => ({ id: c.id, name: c.name, code: c.code, track: c.track, duration_weeks: c.duration_weeks, fee_default: c.fee_default })) },
    { name: "trainers", data: trainers.map(t => ({ id: t.id, name: t.name, email: t.email, phone: t.phone, specialization: t.specialization, status: t.status })) },
    { name: "rooms", data: rooms.map(r => ({ id: r.id, name: r.name, capacity: r.capacity })) },
    { name: "batches", data: batches.map(b => ({ id: b.id, course_id: b.course_id, trainer_id: b.trainer_id, name: b.name, mode: b.mode, start_date: b.start_date, slot_days: typeof b.slot_days === 'string' ? b.slot_days : JSON.stringify(b.slot_days), slot_start: b.slot_start, slot_end: b.slot_end, room_id: b.room_id, online_seat_limit: b.online_seat_limit, student_count: b.student_count, course_name: b.course_name, trainer_name: b.trainer_name })) },
    { name: "students", data: students.map(s => ({ id: s.id, name: s.name, phone: s.phone, email: s.email, batch_id: s.batch_id, status: s.status, joined_on: s.joined_on, course_id: s.course_id, batch_name: s.batch_name })) },
    { name: "fee_plans", data: feePlans.map(fp => ({ id: fp.id, student_id: fp.student_id, course_id: fp.course_id, total: fp.total, discount: fp.discount, status: fp.status })) },
    { name: "instalments", data: instalments.map(i => ({ id: i.id, fee_plan_id: i.fee_plan_id, student_id: i.student_id, seq: i.seq, due_date: i.due_date, amount: i.amount, paid_amount: i.paid_amount, status: i.status })) },
    { name: "users", data: users.map(u => ({ id: u.id, email: u.email, role: u.role, name: u.name })) },
  ];

  for (const { name, data } of seedTables) {
    process.stdout.write(`🌱 Seeding table '${name}' (${data.length} records)... `);
    try {
      const { error } = await supabase.from(name).upsert(data);
      if (error) {
        console.log(`❌ Failed: ${error.message}`);
      } else {
        console.log(`✅ Success`);
      }
    } catch (err) {
      console.log(`⚠️  Error: ${err.message}`);
    }
  }

  console.log("\n🎉 Database seed completed successfully!");
}

runSeed().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
