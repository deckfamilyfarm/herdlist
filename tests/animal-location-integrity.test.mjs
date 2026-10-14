import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { build } from "esbuild";

test("animal locations and their movement records are saved together", { skip: !process.env.HERDLIST_TEST_MYSQL_CNF }, async (t) => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  await fs.mkdir(path.join(root, ".local"), { recursive: true });
  const temp = await fs.mkdtemp(path.join(root, ".local/location-test-"));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const config = Object.fromEntries((await fs.readFile(process.env.HERDLIST_TEST_MYSQL_CNF, "utf8")).split(/\r?\n/).filter(line => /^\w+\s*=/.test(line)).map(line => {
    const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
  assert.ok(config.socket?.startsWith("/"), "Only a local Unix socket can be used for this test.");
  const connection = await mysql.createConnection({ socketPath: config.socket, user: config.user || "root", password: config.password, database: config.database || "mysql", timezone: "Z" });
  try {
    await connection.query(`CREATE TEMPORARY TABLE animals (
      id VARCHAR(36) PRIMARY KEY, tag_number VARCHAR(255) UNIQUE, type VARCHAR(50), sex VARCHAR(20),
      date_of_birth DATE, sire_id VARCHAR(36), dam_id VARCHAR(36), current_field_id VARCHAR(36),
      organic BOOLEAN DEFAULT FALSE, phenotype VARCHAR(1000), polled VARCHAR(32), tags JSON,
      betacasein VARCHAR(32), herd_name VARCHAR(32), status VARCHAR(32) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`);
    await connection.query("CREATE TEMPORARY TABLE fields (id VARCHAR(36) PRIMARY KEY, name VARCHAR(255), property_id VARCHAR(36)) ENGINE=InnoDB");
    await connection.query("CREATE TEMPORARY TABLE movements (id VARCHAR(36) PRIMARY KEY, animal_id VARCHAR(36), from_field_id VARCHAR(36), to_field_id VARCHAR(36), movement_date TIMESTAMP, notes VARCHAR(1000), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
    await connection.query("INSERT INTO fields VALUES ('pasture','Pond Field','property-p'),('barn','Dairy Barn','property-b'),('river','River Field','property-r')");
    globalThis.__locationTestDb = drizzle(connection);
    const outfile = path.join(temp, "storage.mjs");
    await build({ absWorkingDir: root, stdin: { contents: "export { DatabaseStorage } from './server/storage'; export { locationToday } from './shared/animalLocations';", resolveDir: root, loader: "ts" }, outfile, bundle: true, platform: "node", format: "esm", packages: "external", plugins: [{ name: "local-temporary-db", setup(builder) {
      builder.onResolve({ filter: /^\.\/db$/ }, () => ({ path: "fixture-db", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const db = globalThis.__locationTestDb; export const pool = {};", loader: "js" }));
    } }] });
    const { DatabaseStorage, locationToday } = await import(pathToFileURL(outfile).href);
    const storage = new DatabaseStorage();
    const today = locationToday();
    assert.equal(locationToday(new Date("2026-10-14T01:00:00Z")), "2026-10-13");
    const animalData = (tagNumber, currentFieldId = "pasture", status = "active") => ({ tagNumber, currentFieldId, status, type: "dairy", sex: "cow", dateOfBirth: "2024-06-19", tags: [] });
    const count = async () => Number((await connection.query("SELECT COUNT(*) AS n FROM movements"))[0][0].n);
    await assert.rejects(storage.createAnimal(animalData("unlocated", null)), { statusCode: 400 });
    await assert.rejects(storage.createAnimal(animalData("bad-field", "deleted")), { statusCode: 400 });
    assert.equal(await count(), 0);
    const animal = await storage.createAnimal(animalData("2445-test"));
    assert.equal(await count(), 1, "Creating a located animal establishes its initial movement");
    await assert.rejects(storage.updateAnimal(animal.id, { currentFieldId: "barn" }), { statusCode: 400 });
    await assert.rejects(storage.updateAnimal(animal.id, { currentFieldId: null }), { statusCode: 400 });
    assert.equal(await count(), 1);
    await storage.updateAnimal(animal.id, { currentFieldId: "barn" }, { date: today, expectedFieldId: "pasture" });
    const [[state]] = await connection.query("SELECT current_field_id FROM animals WHERE id=?", [animal.id]);
    assert.equal(state.current_field_id, "barn");
    const [history] = await connection.query("SELECT from_field_id, to_field_id FROM movements WHERE animal_id=? AND notes='Location changed in animal editor'", [animal.id]);
    assert.deepEqual(history.map(row => [row.from_field_id, row.to_field_id]), [["pasture", "barn"]]);
    await assert.rejects(storage.updateAnimal(animal.id, { currentFieldId: "river" }, { date: today, expectedFieldId: "pasture" }), { statusCode: 409 });
    await assert.rejects(storage.createMovement({ animalId: animal.id, fromFieldId: "pasture", toFieldId: "river", movementDate: new Date(`${today}T00:00:00Z`) }), { statusCode: 409 });
    await assert.rejects(storage.createMovement({ animalId: animal.id, toFieldId: "river", movementDate: new Date("2020-01-01") }), { statusCode: 409 });
    assert.equal(await count(), 2, "Rejected changes must leave no orphan movement");
    const move = await storage.createMovement({ animalId: animal.id, toFieldId: "river", movementDate: new Date(`${today}T00:00:00Z`) });
    assert.equal(move.fromFieldId, "barn", "Normal moves derive their origin from the locked animal record");
    await storage.updateAnimal(animal.id, { phenotype: "Updated description" });
    assert.equal(await count(), 3, "Unrelated edits must not invent movement records");
    await assert.rejects(storage.deleteField("pasture"), /movement history/);
    await assert.rejects(storage.deleteProperty("property-p"), /movement history/);
    assert.equal(await count(), 3, "Deleting a past location must not erase historical movements");
    const first = await storage.createAnimal(animalData("bulk-a"));
    const second = await storage.createAnimal(animalData("bulk-b"));
    const ids = [first.id, second.id].sort();
    await connection.query("UPDATE animals SET status='sold' WHERE id=?", [ids[1]]);
    const before = await count();
    await assert.rejects(storage.moveAnimalsToField(ids, "barn"), { statusCode: 400 });
    assert.equal(await count(), before, "A failed bulk move rolls back earlier movement inserts");
    const [bulk] = await connection.query("SELECT current_field_id FROM animals WHERE id IN (?,?)", ids);
    assert.ok(bulk.every(row => row.current_field_id === "pasture"));
    await assert.rejects(storage.bulkCreateAnimals([animalData("import-good"), animalData("import-no-location", null)]), { statusCode: 400 });
    const [[imports]] = await connection.query("SELECT COUNT(*) AS n FROM animals WHERE tag_number LIKE 'import-%'");
    assert.equal(Number(imports.n), 0, "Invalid imports cannot partially create unlocated active animals");
  } finally { delete globalThis.__locationTestDb; await connection.end(); }
});
