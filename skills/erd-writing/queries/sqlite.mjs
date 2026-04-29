import { createRequire } from 'node:module';
import { join } from 'node:path';

const requireFromCwd = createRequire(join(process.cwd(), 'noop.js'));

export async function introspect({ conn }) {
  const Database = requireFromCwd('better-sqlite3');
  const db = new Database(conn, { readonly: true, fileMustExist: true });
  try {
    const tableRows = db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      )
      .all();

    const tables = [];
    const fks = [];

    for (const { name } of tableRows) {
      const cols = db.prepare(`PRAGMA table_info(${quoteIdent(name)})`).all();
      const fkRows = db.prepare(`PRAGMA foreign_key_list(${quoteIdent(name)})`).all();
      const fkChildCols = new Set(fkRows.map((r) => r.from));

      tables.push({
        name,
        columns: cols.map((c) => ({
          name: c.name,
          type: c.type || 'ANY',
          pk: c.pk > 0,
          fk: fkChildCols.has(c.name),
          nullable: c.notnull === 0,
        })),
      });

      const grouped = new Map();
      for (const r of fkRows) {
        if (!grouped.has(r.id)) {
          grouped.set(r.id, {
            name: `${name}_fk_${r.id}`,
            parent: r.table,
            child: name,
            childCols: [],
            parentCols: [],
            optional: false,
            label: `${name}_fk_${r.id}`,
          });
        }
        const g = grouped.get(r.id);
        g.childCols.push(r.from);
        g.parentCols.push(r.to);
        const childCol = cols.find((c) => c.name === r.from);
        if (childCol && childCol.notnull === 0) g.optional = true;
      }
      for (const fk of grouped.values()) fks.push(fk);
    }

    return { tables, fks };
  } finally {
    db.close();
  }
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}
