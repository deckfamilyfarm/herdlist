import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { once } from "node:events";
import express from "express";
import { build } from "esbuild";

test("grazing reads accept verified Timesheets tokens and admin sessions while writes still require a session", async (t) => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  await fs.mkdir(path.join(root, ".local"), { recursive: true });
  const temporary = await fs.mkdtemp(path.join(root, ".local/grazing-access-"));
  const oldUrl = process.env.TIMESHEETS_API_URL;
  const oldRoles = process.env.HERDLIST_TIMESHEETS_ALLOWED_ROLES;
  process.env.TIMESHEETS_API_URL = "https://timesheets.example.test/api";
  process.env.HERDLIST_TIMESHEETS_ALLOWED_ROLES = "1,2";
  t.after(async () => {
    if (oldUrl === undefined) delete process.env.TIMESHEETS_API_URL;
    else process.env.TIMESHEETS_API_URL = oldUrl;
    if (oldRoles === undefined) delete process.env.HERDLIST_TIMESHEETS_ALLOWED_ROLES;
    else process.env.HERDLIST_TIMESHEETS_ALLOWED_ROLES = oldRoles;
    await fs.rm(temporary, { recursive: true, force: true });
  });
  const outfile = path.join(temporary, "routes.mjs");
  await build({
    absWorkingDir: root, entryPoints: ["server/routes.ts"], outfile,
    bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-storage-and-sessions", setup(builder) {
      builder.onResolve({ filter: /^\.\/(storage|db)$/ }, ({ path: name }) => ({ path: name, namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path: name }) => ({
        contents: name === "./db" ? "export const pool = {};" : `export const storage = {
          getUser: async () => ({ id: 'admin', isAdmin: 'yes' }),
          getAllFields: async () => [{ id: 'pasture', name: 'Pond Field' }],
          getAllMovements: async () => [], getAllSlaughterRecords: async () => [],
          createHistoricalMovement: async (animalId, entry) => ({ animalId, ...entry }),
          correctHistoricalMovement: async (id, correction) => {
            if (id === 'stale') throw Object.assign(new Error('Changed since opened'), { statusCode: 409 });
            return { id, ...correction.entry };
          }
        };`, loader: "js",
      }));
      builder.onLoad({ filter: /server\/routes\.ts$/ }, async ({ path: filename }) => {
        const source = await fs.readFile(filename, "utf8");
        assert.ok(source.includes("await setupAuth(app);"));
        // Exercise the actual route registrations and auth middleware without
        // creating MySQL-backed sessions or starting the production server.
        return { contents: source.replace("await setupAuth(app);", "/* fixture sessions installed by test */"), loader: "ts" };
      });
    } }],
  });
  const { registerRoutes } = await import(pathToFileURL(outfile).href);
  const token = (username) => `fixture.${Buffer.from(JSON.stringify({ employee_id: "fixture", username })).toString("base64url")}.fixture`;
  const valid = token("recorder"), denied = token("not-allowed"), revoked = token("revoked");
  const realFetch = globalThis.fetch;
  let verifications = 0;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    if (String(input).startsWith("https://timesheets.example.test")) {
      verifications++;
      assert.equal(String(input), "https://timesheets.example.test/api/auth/getUserRole");
      assert.equal(options.method, "POST");
      const authorization = new Headers(options.headers).get("authorization");
      if (authorization === `Bearer ${revoked}`) return Response.json({}, { status: 401 });
      return Response.json({ data: { user_role: authorization === `Bearer ${valid}` ? "1" : "0" } });
    }
    return realFetch(input, options);
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const admin = req.headers["x-fixture-admin"] === "yes";
    req.isAuthenticated = () => admin;
    if (admin) req.user = { id: "admin" };
    next();
  });
  const server = await registerRoutes(app);
  server.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const endpoint of ["/api/fields", "/api/movements", "/api/slaughter-records"]) {
      assert.equal((await fetch(base + endpoint)).status, 401);
      for (const rejected of [denied, revoked])
        assert.equal((await fetch(base + endpoint, { headers: { Authorization: `Bearer ${rejected}` } })).status, 401);
      const read = await fetch(base + endpoint, { headers: { Authorization: `Bearer ${valid}` } });
      assert.equal(read.status, 200);
      assert.ok(Array.isArray(await read.json()));
      assert.equal((await fetch(base + endpoint, { headers: { "x-fixture-admin": "yes" } })).status, 200);
      assert.equal((await fetch(base + endpoint, { method: "POST", headers: {
        Authorization: `Bearer ${valid}`, "Content-Type": "application/json",
      }, body: "{}" })).status, 401);
    }
    assert.equal(verifications, 9);
    const entry = { fromFieldId: null, toFieldId: "pasture", movementDate: "2026-09-01T00:00:00.000Z", notes: null };
    for (const [path, method, body] of [
      ["/api/animals/animal-1/movement-history", "POST", entry],
      ["/api/movements/move-1", "PUT", { entry, expected: entry }],
    ]) {
      const send = (data, headers = {}) => fetch(base + path, { method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(data) });
      assert.equal((await send(body)).status, 401);
      assert.equal((await send(body, { Authorization: `Bearer ${valid}` })).status, 401);
      const admin = { "x-fixture-admin": "yes" };
      assert.equal((await send(body, admin)).status, method === "POST" ? 201 : 200);
      assert.equal((await send({ ...body, animalId: "other-animal" }, admin)).status, 400);
      const invalid = { ...entry, movementDate: "2026-02-30T00:00:00.000Z" };
      assert.equal((await send(method === "POST" ? invalid : { entry: invalid, expected: entry }, admin)).status, 400);
    }
    assert.equal((await fetch(base + "/api/movements/stale", {
      method: "PUT", headers: { "Content-Type": "application/json", "x-fixture-admin": "yes" }, body: JSON.stringify({ entry, expected: entry }),
    })).status, 409);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
