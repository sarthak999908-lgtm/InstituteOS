const batchTerms = [
  ["java", "Java"],
  ["python", "Python"],
  ["devops", "DevOps"],
  ["testing", "Testing"],
  ["ui/ux", "UI/UX"],
  ["design", "UI/UX"],
];

export function extractBatch(question, previousBatch = "") {
  const normalized = question.toLowerCase();
  for (const [term, value] of batchTerms) {
    if (normalized.includes(term)) return value;
  }
  return previousBatch;
}

export function extractThreshold(question, fallback = 3) {
  const normalized = question.toLowerCase();
  const wordNumbers = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const match = normalized.match(/(?:at least|three or more|more than|over|minimum(?: of)?)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/);
  if (!match) return fallback;
  const value = Number(match[1]) || wordNumbers[match[1]];
  return normalized.includes("more than") || normalized.includes("over ") ? value + 1 : value;
}

export function detectAction(question) {
  const normalized = question.toLowerCase();
  if (/whatsapp|draft .*reminder|send .*reminder/.test(normalized)) return "whatsapp_reminder";
  if (/mark .*absent|mark attendance/.test(normalized)) return "mark_absent";
  if (/extend .*due date|change .*due date/.test(normalized)) return "extend_due_date";
  if (/send .*receipt|issue .*receipt/.test(normalized)) return "send_receipt";
  return null;
}

export function isFinanceQuestion(question) {
  return /\b(?:emi|emis|fee|fees|payment|payments|paid|unpaid|outstanding|instalment|installment|collection|collections)\b|(?:not\s+paid|hasn.t\s+paid|pending\s+(?:amount|balance)|due\s+amount)/i.test(question);
}

export function isIdentityFinanceQuestion(question) {
  return /\b(?:who|which students?|names?|contact|remind|whatsapp)\b/i.test(question);
}

export function planIntent(question, context = {}) {
  const normalized = question.toLowerCase();
  const batch = extractBatch(question, context.batch);
  const action = detectAction(question);
  const threshold = extractThreshold(question, context.threshold || 3);
  const finance = isFinanceQuestion(question);

  if (/missed|absence|absent|skipped/.test(normalized) && finance) return { intent: "missed_emis", batch, threshold, action };
  if (/missed|absence|absent|skipped/.test(normalized)) return { intent: "missed_classes", batch, threshold, action };
  if (/collected|received/.test(normalized) && /today|month|this month/.test(normalized)) return { intent: "fees_collected", period: normalized.includes("today") ? "today" : "month", action };
  if (finance && /overdue|due|pending|outstanding|balance|unpaid|paid|emi|instalment|installment/.test(normalized)) {
    return { intent: "emi_due", period: normalized.includes("overdue") ? "overdue" : normalized.includes("today") ? "today" : "week", action };
  }
  if (/dropout|at risk|risk student/.test(normalized)) return { intent: "dropout_risk", threshold, action };
  if (/trainer|instructor/.test(normalized) && /load|hours|schedule|busy/.test(normalized)) return { intent: "trainer_load", action };
  if (/free room|available room|room availability/.test(normalized)) return { intent: "free_rooms", action };
  if (/absent today|who.*absent/.test(normalized)) return { intent: "absent_today", action };
  if (/recording|recorded session/.test(normalized)) return { intent: "recordings", batch, action };
  if (/fill rate|capacity|how full/.test(normalized)) return { intent: "fill_rate", batch, action };
  if (/unpaid.*course|students?.*course.*(?:fee|emi|unpaid)/.test(normalized)) return { intent: "unpaid_by_course", action };
  return { intent: "overview", batch, action };
}

export function dateWindow(period, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  if (period === "today") return { start: isoDate(start), end: isoDate(start) };
  if (period === "month") {
    return { start: isoDate(new Date(start.getFullYear(), start.getMonth(), 1)), end: isoDate(new Date(start.getFullYear(), start.getMonth() + 1, 0)) };
  }
  if (period === "overdue") {
    end.setDate(end.getDate() - 1);
    return { start: "0001-01-01", end: isoDate(end) };
  }
  if (period === "tomorrow") start.setDate(start.getDate() + 1);
  else start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  end.setTime(start.getTime());
  end.setDate(end.getDate() + (period === "tomorrow" ? 0 : 6));
  return { start: isoDate(start), end: isoDate(end) };
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}