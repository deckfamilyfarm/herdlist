import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import { build } from "esbuild";

test("historical corrections validate input, preserve present location, and reject stale or invalid edits atomically", async (t) => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  await fs.mkdir(path.join(root, ".local"), { recursive: true });
  const temp = await fs.mkdtemp(path.join(root, ".local/history-test-"));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const outfile = path.join(temp, "history.mjs");
  await build({
    absWorkingDir: root, stdin: { contents: `export { saveMovementHistory } from './server/movementHistory'; export { historyEntrySchema, historyCorrectionSchema } from './shared/movementHistory';`, resolveDir: root, loader: "ts" },
    outfile, bundle: true, format: "esm", platform: "node", packages: "external",
  });
  const { saveMovementHistory, historyEntrySchema, historyCorrectionSchema } = await import(pathToFileURL(outfile).href);
  const entry = { fromFieldId: null, toFieldId: "pasture", movementDate: "2026-09-01T00:00:00.000Z", notes: "Confirmed from chore records" };
  assert.ok(historyEntrySchema.safeParse(entry).success);
  for (const movementDate of ["bad", "2026-02-30T00:00:00.000Z", "2026-13-01T00:00:00.000Z"])
    assert.equal(historyEntrySchema.safeParse({ ...entry, movementDate }).success, false);
  assert.equal(historyCorrectionSchema.safeParse({ entry, expected: entry, animalId: "other" }).success, false);

  await t.test("real MySQL transactions on temporary local tables", { skip: !process.env.HERDLIST_TEST_MYSQL_CNF }, async () => {
    const cnf = await fs.readFile(process.env.HERDLIST_TEST_MYSQL_CNF, "utf8");
    const config = Object.fromEntries(cnf.split(/\r?\n/).filter((line) => /^\w+\s*=/.test(line)).map((line) => {
      const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }));
    assert.ok(config.socket?.startsWith("/"), "This test requires a local Unix socket and never connects to production.");
    const connection = await mysql.createConnection({ socketPath: config.socket, user: config.user || "root", password: config.password, database: config.database || "mysql", timezone: "Z" });
    try {
      // Temporary tables shadow any persistent tables only on this connection.
      await connection.query("CREATE TEMPORARY TABLE animals (id VARCHAR(36) PRIMARY KEY, current_field_id VARCHAR(36)) ENGINE=InnoDB");
      await connection.query("CREATE TEMPORARY TABLE fields (id VARCHAR(36) PRIMARY KEY) ENGINE=InnoDB");
      await connection.query("CREATE TEMPORARY TABLE movements (id VARCHAR(36) PRIMARY KEY, animal_id VARCHAR(36), from_field_id VARCHAR(36), to_field_id VARCHAR(36), movement_date TIMESTAMP, notes VARCHAR(1000), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
      await connection.query("INSERT INTO animals VALUES ('animal', 'barn')");
      await connection.query("INSERT INTO fields VALUES ('pasture'), ('barn')");
      const fixturePool = { getConnection: async () => new Proxy(connection, { get(target, key) {
        if (key === "release") return () => {};
        const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
      } }) };
      const created = await saveMovementHistory(fixturePool, { animalId: "animal", entry });
      let [[animal]] = await connection.query("SELECT current_field_id FROM animals WHERE id='animal'");
      assert.equal(animal.current_field_id, "barn", "Backdated additions must not transfer the animal today");
      const corrected = { ...entry, fromFieldId: "barn", movementDate: "2026-08-25T00:00:00.000Z", notes: "Corrected actual date" };
      await saveMovementHistory(fixturePool, { id: created.id, entry: corrected, expected: entry });
      await assert.rejects(saveMovementHistory(fixturePool, { id: created.id, entry, expected: entry }), { statusCode: 409 });
      await assert.rejects(saveMovementHistory(fixturePool, { id: created.id, entry: { ...entry, toFieldId: "deleted" }, expected: corrected }), { statusCode: 400 });
      await assert.rejects(saveMovementHistory(fixturePool, { id: "not-found", entry, expected: entry }), { statusCode: 404 });
      await assert.rejects(saveMovementHistory(fixturePool, { animalId: "not-found", entry }), { statusCode: 404 });
      const [[row]] = await connection.query("SELECT to_field_id, notes FROM movements WHERE id=?", [created.id]);
      assert.equal(row.to_field_id, "pasture"); assert.equal(row.notes, "Corrected actual date");
      [[animal]] = await connection.query("SELECT current_field_id FROM animals WHERE id='animal'");
      assert.equal(animal.current_field_id, "barn", "Corrections must preserve the present location");
    } finally { await connection.end(); }
  });
});
