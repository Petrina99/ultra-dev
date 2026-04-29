import { createRequire } from 'node:module';
import { join } from 'node:path';

const requireFromCwd = createRequire(join(process.cwd(), 'noop.js'));

export async function introspect({ conn, schema = 'dbo' }) {
  const sql = requireFromCwd('mssql');
  const pool = await sql.connect(conn);
  try {
    const colsRes = await pool
      .request()
      .input('schema', sql.NVarChar, schema)
      .query(`
        SELECT
          c.TABLE_NAME      AS table_name,
          c.COLUMN_NAME     AS column_name,
          c.DATA_TYPE       AS data_type,
          c.IS_NULLABLE     AS is_nullable,
          CAST(CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS is_pk,
          CAST(CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS is_fk
        FROM INFORMATION_SCHEMA.COLUMNS c
        JOIN INFORMATION_SCHEMA.TABLES t
          ON t.TABLE_SCHEMA = c.TABLE_SCHEMA
         AND t.TABLE_NAME   = c.TABLE_NAME
        LEFT JOIN (
          SELECT kcu.TABLE_SCHEMA, kcu.TABLE_NAME, kcu.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
           AND tc.TABLE_SCHEMA    = kcu.TABLE_SCHEMA
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        ) pk
          ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA
         AND pk.TABLE_NAME   = c.TABLE_NAME
         AND pk.COLUMN_NAME  = c.COLUMN_NAME
        LEFT JOIN (
          SELECT kcu.TABLE_SCHEMA, kcu.TABLE_NAME, kcu.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
           AND tc.TABLE_SCHEMA    = kcu.TABLE_SCHEMA
          WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
        ) fk
          ON fk.TABLE_SCHEMA = c.TABLE_SCHEMA
         AND fk.TABLE_NAME   = c.TABLE_NAME
         AND fk.COLUMN_NAME  = c.COLUMN_NAME
        WHERE c.TABLE_SCHEMA = @schema
          AND t.TABLE_TYPE   = 'BASE TABLE'
        ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
      `);

    const fksRes = await pool
      .request()
      .input('schema', sql.NVarChar, schema)
      .query(`
        SELECT
          fk.name                                AS name,
          OBJECT_NAME(fkc.parent_object_id)      AS child,
          cpa.name                               AS child_col,
          OBJECT_NAME(fkc.referenced_object_id)  AS parent,
          cre.name                               AS parent_col,
          cpa.is_nullable                        AS child_nullable,
          fkc.constraint_column_id
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc
          ON fk.object_id = fkc.constraint_object_id
        JOIN sys.columns cpa
          ON cpa.object_id = fkc.parent_object_id
         AND cpa.column_id = fkc.parent_column_id
        JOIN sys.columns cre
          ON cre.object_id = fkc.referenced_object_id
         AND cre.column_id = fkc.referenced_column_id
        WHERE SCHEMA_NAME(fk.schema_id) = @schema
        ORDER BY fk.name, fkc.constraint_column_id
      `);

    const tableMap = new Map();
    for (const r of colsRes.recordset) {
      if (!tableMap.has(r.table_name)) {
        tableMap.set(r.table_name, { name: r.table_name, columns: [] });
      }
      tableMap.get(r.table_name).columns.push({
        name: r.column_name,
        type: r.data_type,
        pk: !!r.is_pk,
        fk: !!r.is_fk,
        nullable: r.is_nullable === 'YES',
      });
    }

    const fkMap = new Map();
    for (const r of fksRes.recordset) {
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
      if (r.child_nullable) fk.optional = true;
    }

    return { tables: [...tableMap.values()], fks: [...fkMap.values()] };
  } finally {
    await pool.close();
  }
}
