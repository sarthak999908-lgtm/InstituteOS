import { describe, expect, it } from "vitest";
import { hasScheduleClashes, solveSchedule } from "./solver.js";

function makeSchedule(seed = 0) {
  const trainers = Array.from({ length: 8 }, (_, index) => ({ id: `T-${index}`, name: `Trainer ${index}`, weekly_hours_max: 16 }));
  const rooms = Array.from({ length: 4 }, (_, index) => ({ id: `R-${index}`, name: `Room ${index}`, capacity: 30 + index * 2 }));
  const availability = trainers.flatMap((trainer) => [1, 2, 3, 4, 5, 6].map((weekday) => ({ trainer_id: trainer.id, weekday, start: "09:00", end: "18:00" })));
  const batches = Array.from({ length: 12 }, (_, index) => ({
    id: `B-${index}`,
    name: index === 0 ? "Java-A" : `Batch ${index}`,
    trainer_id: trainers[(index + seed) % trainers.length].id,
    room_id: rooms[index % rooms.length].id,
    mode: index % 3 === 0 ? "hybrid" : "classroom",
    student_count: 16 + ((index + seed) % 9),
    online_seat_limit: 8,
    weekly_sessions: 2,
    duration_hours: index % 4 === 0 ? 1 : 2,
    slot_days: JSON.stringify([1 + ((index + seed) % 6), 1 + ((index + seed + 2) % 6)]),
    slot_start: "10:00",
  }));
  return { trainers, rooms, availability, batches };
}

describe("weekly schedule solver", () => {
  it("returns clash-free grids for 50 randomized 12-batch inputs", () => {
    const started = performance.now();
    for (let seed = 0; seed < 50; seed += 1) {
      const result = solveSchedule(makeSchedule(seed));
      expect(result.ok).toBe(true);
      expect(result.grid).toHaveLength(24);
      expect(hasScheduleClashes(result.grid)).toBe(false);
    }
    const singleRunStarted = performance.now();
    const oneRun = solveSchedule(makeSchedule(51));
    expect(oneRun.ok).toBe(true);
    expect(oneRun.nodes).toBeLessThan(30000);
    expect(performance.now() - singleRunStarted).toBeLessThan(1500);
    expect(performance.now() - started).toBeLessThan(40000);
  }, 45000);

  it("explains moved slots when a trainer loses a weekly availability window", () => {
    const input = makeSchedule(4);
    const previousGrid = [{ batch_id: "B-0", batch_name: "Java-A", weekday: 2, start: "10:00", end: "12:00", trainer_id: "T-4", room_id: "R-0", room_name: "Room 0" }];
    input.availability = input.availability.filter((slot) => !(slot.trainer_id === "T-4" && slot.weekday === 2));
    const result = solveSchedule(input, { previousGrid, reason: "Trainer 4 is unavailable Tuesday; Room 2 was free." });
    expect(result.ok).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes.every((change) => change.reason.length > 0)).toBe(true);
  });

  it("returns useful relaxations when a room cannot fit the group", () => {
    const input = makeSchedule();
    input.rooms = [{ id: "TINY", name: "Tiny room", capacity: 2 }];
    const result = solveSchedule(input);
    expect(result.ok).toBe(false);
    expect(result.relaxations).toHaveLength(2);
  });
});
