import { getPolicy } from "./policy.js";

const blockedWords = /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|ATTACH|DETACH|PRAGMA|REPLACE|CREATE|VACUUM|REINDEX|TRIGGER)\b/i;
const keywords = new Set("select with recursive as distinct from join inner left right outer cross on where and or not in is null like between group by having order asc desc limit offset case when then else end count sum avg min max coalesce cast ifnull true false union all exists date datetime julianday strftime round abs lower upper length instr replace trim typeof".split(" "));

function removeStringLiterals(sql) {
  return sql.replace(/'(?:''|[^'])*'/g, "''");
}

function parseReferences(sql, allowedTables) {
  const ctes = new Set();
  for (const match of sql.matchAll(/\b(?:WITH|,)\s*([a-z_][\w]*)\s+AS\s*\(/gi)) {
    ctes.add(match[1].toLowerCase());
  }

  const tableAliases = new Map();
  const referencedTables = new Set();
  const tablePattern = /\b(?:FROM|JOIN)\s+([a-z_][\w]*)(?:\s+(?:AS\s+)?(?!(?:JOIN|LEFT|RIGHT|FULL|INNER|OUTER|CROSS|WHERE|GROUP|ORDER|HAVING|LIMIT|UNION|ON)\b)([a-z_][\w]*))?/gi;
  for (const match of sql.matchAll(tablePattern)) {
    const table = match[1].toLowerCase();
    if (ctes.has(table)) {
      tableAliases.set(match[2]?.toLowerCase() || table, null);
      continue;
    }
    if (!Object.hasOwn(allowedTables, table)) throw new Error(`Table "${table}" is not available to this role.`);
    referencedTables.add(table);
    tableAliases.set(table, table);
    if (match[2]) {
      const alias = match[2].toLowerCase();
      if (!keywords.has(alias) && !Object.hasOwn(allowedTables, alias)) tableAliases.set(alias, table);
    }
  }

  if (!referencedTables.size && !ctes.size) throw new Error("The query must reference an allowed table.");

  for (const match of sql.matchAll(/\b([a-z_][\w]*)\.([a-z_][\w]*)\b/gi)) {
    const qualifier = match[1].toLowerCase();
    const column = match[2].toLowerCase();
    if (ctes.has(qualifier)) continue;
    const table = tableAliases.get(qualifier);
    if (!table) throw new Error(`Unknown table or alias "${qualifier}".`);
    if (!allowedTables[table].includes(column)) throw new Error(`Column "${column}" is not available on "${table}".`);
  }

  const aliases = new Set(Array.from(sql.matchAll(/\bAS\s+([a-z_][\w]*)/gi), (match) => match[1].toLowerCase()));
  const knownColumns = new Set(Array.from(referencedTables).flatMap((table) => allowedTables[table]));
  const identifiers = removeStringLiterals(sql).replace(/\b\d+(?:\.\d+)?\b/g, " ").match(/[a-z_][\w]*/gi) || [];
  const qualifiedColumns = new Set(Array.from(sql.matchAll(/\b[a-z_][\w]*\.([a-z_][\w]*)\b/gi), (match) => match[1].toLowerCase()));
  for (const identifier of identifiers.map((value) => value.toLowerCase())) {
    if (keywords.has(identifier) || aliases.has(identifier) || ctes.has(identifier) || tableAliases.has(identifier)) continue;
    if (qualifiedColumns.has(identifier) || knownColumns.has(identifier)) continue;
    throw new Error(`Identifier "${identifier}" is not an allowed column or SQL keyword.`);
  }

  return { ctes, referencedTables };
}

export function guardSql(sql, role = "owner", params = [], policyOverride = null) {
  if (typeof sql !== "string" || !sql.trim()) throw new Error("A query is required.");
  if (/[;]|--|\/\*|\*\//.test(sql)) throw new Error("Only a single statement without comments is allowed.");
  const source = sql.trim();
  const normalized = removeStringLiterals(source).trim();
  if (!/^(?:SELECT|WITH)\b/i.test(normalized)) throw new Error("Only read-only SELECT queries are allowed.");
  if (blockedWords.test(normalized)) throw new Error("The query contains a blocked operation.");

  const policy = policyOverride || getPolicy(role);
  const { referencedTables } = parseReferences(normalized, policy.tables);
  const limitMatch = normalized.match(/\bLIMIT\s+(\d+)\s*$/i);
  if (limitMatch && Number(limitMatch[1]) > 200) throw new Error("The maximum result limit is 200 rows.");
  const safeSql = limitMatch ? source : `${source} LIMIT 200`;

  return { sql: safeSql, params, tables: [...referencedTables], role };
}
