const DAY_MINUTES = 1440;

function toMinutes(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

function toTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function parseDays(value) {
  if (Array.isArray(value)) return value.map(Number);
  try { return JSON.parse(value || "[]").map(Number); }
  catch { return []; }
}

function durationHours(batch) {
  if (Number(batch.duration_hours || batch.duration)) return Number(batch.duration_hours || batch.duration);
  return Math.max(0.5, (toMinutes(batch.slot_end || "11:00") - toMinutes(batch.slot_start || "10:00")) / 60);
}

function overlaps(first, second) {
  if (first.weekday !== second.weekday) return false;
  return toMinutes(first.start) < toMinutes(second.end) && toMinutes(second.start) < toMinutes(first.end);
}

function offlineHeadcount(batch) {
  if (batch.mode === "online") return 0;
  if (Number.isFinite(Number(batch.offline_students))) return Number(batch.offline_students);
  if (batch.mode === "hybrid") {
    const preferredOnline = Number(batch.online_students ?? Math.floor((Number(batch.student_count) || 0) / 2));
    const online = Math.min(Number(batch.student_count) || 0, Number(batch.online_seat_limit) || 0, preferredOnline);
    return Math.max(0, (Number(batch.student_count) || 0) - online);
  }
  return Number(batch.student_count) || 0;
}

function availabilityFor(trainerId, weekday, availability) {
  return availability.filter((slot) => slot.trainer_id === trainerId && Number(slot.weekday) === weekday);
}

function createCandidates(occurrence, input, state) {
  const { batches, trainers, availability, rooms } = input;
  const batch = occurrence.batch;
  const trainerCandidates = trainers.filter((trainer) => !batch.trainer_id || trainer.id === batch.trainer_id);
  const roomCandidates = batch.mode === "online" ? [null] : rooms.filter((room) => room.capacity >= offlineHeadcount(batch));
  if (!trainerCandidates.length || !roomCandidates.length) return [];
  const preferredDays = parseDays(batch.slot_days);
  const candidates = [];

  for (const trainer of trainerCandidates) {
    const trainerCap = Number(trainer.weekly_hours_max) || Infinity;
    for (let weekday = 1; weekday <= 6; weekday += 1) {
      for (const available of availabilityFor(trainer.id, weekday, availability)) {
        const lower = toMinutes(available.start);
        const upper = toMinutes(available.end);
        const duration = durationHours(batch);
        for (let start = lower; start + duration * 60 <= upper; start += 30) {
          const end = start + duration * 60;
          const candidate = {
            id: `${batch.id}-${occurrence.number}`,
            batch_id: batch.id,
            batch_name: batch.name,
            occurrence: occurrence.number,
            weekday,
            start: toTime(start),
            end: toTime(end),
            trainer_id: trainer.id,
            trainer_name: trainer.name,
            room_id: roomCandidates[0]?.id || null,
            room_name: roomCandidates[0]?.name || "Online",
            mode: batch.mode || "classroom",
            student_count: Number(batch.student_count) || 0,
            online_seat_limit: Number(batch.online_seat_limit) || 0,
            duration_hours: duration,
          };
          for (const room of roomCandidates) {
            const placed = { ...candidate, room_id: room?.id || null, room_name: room?.name || "Online" };
            if ((state.hours.get(trainer.id) || 0) + duration > trainerCap) continue;
            if (state.grid.some((slot) =>
              (slot.trainer_id === trainer.id || (placed.room_id && slot.room_id === placed.room_id) || slot.batch_id === batch.id) && overlaps(slot, placed)
            )) continue;
            if (batch.mode === "online" && (Number(batch.online_students) || Number(batch.student_count) || 0) > Number(batch.online_seat_limit || 0)) continue;
            candidates.push({ slot: placed, score: scoreCandidate(placed, batch, preferredDays, state) });
          }
        }
      }
    }
  }
  return candidates.sort((first, second) => first.score - second.score);
}

function scoreCandidate(slot, batch, preferredDays, state) {
  let score = preferredDays.length && !preferredDays.includes(slot.weekday) ? 5 : 0;
  const preferredStart = batch.preferred_start || batch.slot_start;
  if (preferredStart) score += Math.abs(toMinutes(slot.start) - toMinutes(preferredStart)) / 30;
  score += state.hours.get(slot.trainer_id, 0) * 0.15;
  const batchDays = state.grid.filter((item) => item.batch_id === slot.batch_id).map((item) => item.weekday);
  if (batchDays.includes(slot.weekday)) score += 20;
  const trainerSameDay = state.grid.filter((item) => item.trainer_id === slot.trainer_id && item.weekday === slot.weekday);
  if (trainerSameDay.length) {
    const gap = Math.min(...trainerSameDay.map((item) => Math.abs(toMinutes(item.start) - toMinutes(slot.end))), ...trainerSameDay.map((item) => Math.abs(toMinutes(slot.start) - toMinutes(item.end))));
    score += Math.max(0, gap / 60) * 0.35;
  }
  return score;
}

function buildChanges(previousGrid, nextGrid, reason) {
  const changes = [];
  const batchIds = new Set([...previousGrid, ...nextGrid].map((slot) => slot.batch_id));
  for (const batchId of batchIds) {
    const before = previousGrid.filter((slot) => slot.batch_id === batchId).sort(compareSlot);
    const after = nextGrid.filter((slot) => slot.batch_id === batchId).sort(compareSlot);
    for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
      const from = before[index];
      const to = after[index];
      if (!from || !to || from.weekday !== to.weekday || from.start !== to.start || from.trainer_id !== to.trainer_id || from.room_id !== to.room_id) {
        const batchName = to?.batch_name || from?.batch_name || batchId;
        changes.push({
          batch_id: batchId,
          batch_name: batchName,
          from: from ? `${from.start} day ${from.weekday}, ${from.room_name || "Online"}` : "Unscheduled",
          to: to ? `${to.start} day ${to.weekday}, ${to.room_name || "Online"}` : "Removed",
          reason: reason || "Moved to preserve trainer availability, room capacity, and clash-free weekly coverage.",
        });
      }
    }
  }
  return changes;
}

function compareSlot(first, second) {
  return first.weekday - second.weekday || toMinutes(first.start) - toMinutes(second.start);
}

export function solveSchedule(input, options = {}) {
  const batches = input.batches || [];
  const trainers = input.trainers || [];
  const rooms = input.rooms || [];
  const availability = input.availability || input.trainer_availability || [];
  const occurrences = batches.flatMap((batch) => Array.from({ length: Math.max(1, Number(batch.weekly_sessions || batch.sessions_per_week) || 1) }, (_, index) => ({ batch, number: index + 1 })));
  const grid = [];
  const hours = new Map();
  let nodes = 0;
  const nodeLimit = 30000;

  function search(remaining) {
    nodes += 1;
    if (!remaining.length) return true;
    if (nodes > nodeLimit) return false;
    let selectedIndex = -1;
    let selectedCandidates = null;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidates = createCandidates(remaining[index], { batches, trainers, availability, rooms }, { grid, hours });
      if (!selectedCandidates || candidates.length < selectedCandidates.length) {
        selectedIndex = index;
        selectedCandidates = candidates;
      }
      if (!candidates.length) return false;
      if (candidates.length === 1) break;
    }

    const rest = remaining.filter((_, index) => index !== selectedIndex);
    for (const { slot } of selectedCandidates || []) {
      grid.push(slot);
      hours.set(slot.trainer_id, (hours.get(slot.trainer_id) || 0) + slot.duration_hours);
      if (search(rest)) return true;
      grid.pop();
      hours.set(slot.trainer_id, (hours.get(slot.trainer_id) || 0) - slot.duration_hours);
    }
    return false;
  }

  const constrainedFirst = occurrences.sort((first, second) => {
    const firstBatch = first.batch;
    const secondBatch = second.batch;
    const firstOptions = (firstBatch.trainer_id ? 0 : trainers.length) + (firstBatch.mode === "online" ? 1 : rooms.filter((room) => room.capacity >= offlineHeadcount(firstBatch)).length);
    const secondOptions = (secondBatch.trainer_id ? 0 : trainers.length) + (secondBatch.mode === "online" ? 1 : rooms.filter((room) => room.capacity >= offlineHeadcount(secondBatch)).length);
    return firstOptions - secondOptions || durationHours(secondBatch) - durationHours(firstBatch);
  });
  const solved = search(constrainedFirst);
  if (!solved) {
    return {
      ok: false,
      grid: [],
      changes: [],
      nodes,
      reason: "No clash-free weekly grid satisfies the current trainer, room, capacity, and weekly-hour constraints.",
      relaxations: ["Allow one additional trainer availability window.", "Use the next larger room or increase the online seat limit."],
    };
  }

  grid.sort(compareSlot);
  return {
    ok: true,
    grid,
    changes: buildChanges(options.previousGrid || [], grid, options.reason),
    nodes,
  };
}

export function hasScheduleClashes(grid) {
  for (let firstIndex = 0; firstIndex < grid.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < grid.length; secondIndex += 1) {
      const first = grid[firstIndex];
      const second = grid[secondIndex];
      if (!(first.trainer_id === second.trainer_id || (first.room_id && first.room_id === second.room_id) || first.batch_id === second.batch_id)) continue;
      if (overlaps(first, second)) return true;
    }
  }
  return false;
}