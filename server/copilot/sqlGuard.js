import { guardSql } from "../../src/lib/sqlGuard.js";
import { getAllowedSchema } from "./schema.js";

const scalar = (value) => value === null || ["string", "number", "boolean"].includes(typeof value);

export function guardCopilotSql(input, role, params = []) {
  if (typeof input !== "string" || !input.trim() || input.length > 12000) {
    throw new Error("Provide one read-only query under 12,000 characters.");
  }
  if (!Array.isArray(params) || params.length > 20 || !params.every(scalar)) {
    throw new Error("Query parameters must be at most 20 scalar values.");
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input)) {
    throw new Error("Control characters are not allowed in queries.");
  }
  if (/[;]|--|\/\*|\*\/|`|"|\$\$/i.test(input)) {
    throw new Error("Only one query without comments or quoted identifiers is allowed.");
  }
  const countStarRemoved = input.replace(/\bcount\s*\(\s*\*\s*\)/gi, "COUNT(1)");
  if (countStarRemoved.includes("*")) throw new Error("Wildcard column selection is not allowed.");
  const lexical = input.replace(/'(?:''|[^'])*'/g, "''");
  if (/\b(?:INTO|FOR\s+(?:UPDATE|SHARE)|LOCK|COPY|CALL|DO|EXPLAIN|SET|RESET|SHOW|TABLE|RECURSIVE)\b|\bCROSS\s+JOIN\b/i.test(lexical)) {
    throw new Error("The query contains a blocked operation.");
  }

  if (/\$\d+/.test(lexical)) throw new Error("Use one ? placeholder for each bound parameter.");
  const placeholderCount = (lexical.match(/\?/g) || []).length;
  if (placeholderCount !== params.length) throw new Error("Every ? placeholder must have one matching bound parameter.");

  const policy = getAllowedSchema(role);
  const guarded = guardSql(input, role, params, policy);
  return { ...guarded, params };
}
