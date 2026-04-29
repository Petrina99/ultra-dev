import { createRequire } from 'node:module';
import { join } from 'node:path';

const requireFromCwd = createRequire(join(process.cwd(), 'noop.js'));

export async function introspect({ conn, schema = 'public' }) {
  const { Client } = requireFromCwd('pg');
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    const colsRes = await client.query(
      `
      SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema    = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema    = c.table_schema
            AND tc.table_name      = c.table_name
            AND kcu.column_name    = c.column_name
        ) AS is_pk,
        EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema    = kcu.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema    = c.table_schema
            AND tc.table_name      = c.table_name
            AND kcu.column_name    = c.column_name
        ) AS is_fk
      FROM information_schema.columns c
      JOIN information_schema.tables  t
        ON t.table_schema = c.table_schema
       AND t.table_name   = c.table_name
      WHERE c.table_schema = $1
        AND t.table_type   = 'BASE TABLE'
      ORDER BY c.table_name, c.ordinal_position
      `,
      [schema],
    );

    const fksRes = await client.query(
      `
      SELECT
        tc.constraint_name AS name,
        tc.table_name      AS child,
        kcu.column_name    AS child_col,
        ccu.table_name     AS parent,
        ccu.column_name    AS parent_col,
        col.is_nullable    AS child_nullable,
        kcu.ordinal_position
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
      JOIN information_schema.columns col
        ON col.table_schema = tc.table_schema
       AND col.table_name   = tc.table_name
       AND col.column_name  = kcu.column_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema    = $1
      ORDER BY tc.constraint_name, kcu.ordinal_position
      `,
      [schema],
    );

    const tableMap = new Map();
    for (const r of colsRes.rows) {
      if (!tableMap.has(r.table_name)) {
        tableMap.set(r.table_name, { name: r.table_name, columns: [] });
      }
      tableMap.get(r.table_name).columns.push({
        name: r.column_name,
        type: r.data_type,
        pk: r.is_pk,
        fk: r.is_fk,
        nullable: r.is_nullable === 'YES',
      });
    }

    const fkMap = new Map();
    for (const r of fksRes.rows) {
      if (!fkMap.has(r.name)) {
        fkMap.set(r.name, {
          name: r.name,
          child: r.child,
          parent: r.parent,
          childCols: [],
          parentCols: [],
          optional: false,
          label: r.name,
        });
      }
      const fk = fkMap.get(r.name);
      fk.childCols.push(r.child_col);
      fk.parentCols.push(r.parent_col);
      if (r.child_nullable === 'YES') fk.optional = true;
    }

    return { tables: [...tableMap.values()], fks: [...fkMap.values()] };
  } finally {
    await client.end();
  }
}
