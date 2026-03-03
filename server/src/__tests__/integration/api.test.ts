import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { createTestDb, createTestServer, seedTestData, makeImmobilie } from "../helpers.js";
import type { Database } from "bun:sqlite";

let db: Database;
let baseUrl: string;
let close: () => Promise<void>;

beforeAll(() => {
  db = createTestDb();
  const srv = createTestServer();
  baseUrl = srv.baseUrl;
  close = srv.close;
});

afterAll(async () => {
  await close();
});

beforeEach(() => {
  // Clear data between tests
  db.exec("DELETE FROM immobilien");
});

describe("Health", () => {
  it("GET /api/health → 200", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});

describe("CRUD /api/immobilien", () => {
  it("POST → 201 creates a new Immobilie", async () => {
    const res = await fetch(`${baseUrl}/api/immobilien`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeImmobilie()),
    });
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.id).toBeDefined();
    expect(data.strasse).toBe("Teststraße");
  });

  it("GET /:id → 200 retrieves created Immobilie", async () => {
    const createRes = await fetch(`${baseUrl}/api/immobilien`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeImmobilie()),
    });
    const { data: created } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/immobilien/${created.id}`);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.id).toBe(created.id);
    expect(data.bilder).toEqual([]);
  });

  it("PUT /:id → 200 updates Immobilie", async () => {
    const createRes = await fetch(`${baseUrl}/api/immobilien`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeImmobilie()),
    });
    const { data: created } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/immobilien/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ort: "Hamburg" }),
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.ort).toBe("Hamburg");
  });

  it("DELETE /:id → 204 removes Immobilie", async () => {
    const createRes = await fetch(`${baseUrl}/api/immobilien`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeImmobilie()),
    });
    const { data: created } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/immobilien/${created.id}`, { method: "DELETE" });
    expect(res.status).toBe(204);

    // Verify it's gone
    const getRes = await fetch(`${baseUrl}/api/immobilien/${created.id}`);
    expect(getRes.status).toBe(404);
  });

  it("GET /:id → 404 for non-existent", async () => {
    const res = await fetch(`${baseUrl}/api/immobilien/99999`);
    expect(res.status).toBe(404);
  });

  it("POST → 400 for invalid payload", async () => {
    const res = await fetch(`${baseUrl}/api/immobilien`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strasse: "" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("DELETE /:id → 404 for non-existent", async () => {
    const res = await fetch(`${baseUrl}/api/immobilien/99999`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("Filters /api/immobilien", () => {
  beforeEach(() => {
    seedTestData(db);
  });

  it("GET / returns all with meta", async () => {
    const res = await fetch(`${baseUrl}/api/immobilien`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(3);
    expect(body.meta.gesamt).toBe(3);
  });

  it("filters by typ=wohnung", async () => {
    const res = await fetch(`${baseUrl}/api/immobilien?typ=wohnung`);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].typ).toBe("wohnung");
  });

  it("combines filters: status + preis range", async () => {
    const res = await fetch(`${baseUrl}/api/immobilien?status=verfuegbar&preis_max=300000`);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].ort).toBe("Berlin");
  });

  it("FTS search finds by text", async () => {
    const res = await fetch(`${baseUrl}/api/immobilien?suche=Hauptstraße`);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].strasse).toBe("Hauptstraße");
  });

  it("date filter works", async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch(`${baseUrl}/api/immobilien?erstellt_von=${today}&erstellt_bis=${today}`);
    const body = await res.json();
    expect(body.data.length).toBe(3);
  });
});

describe("Stats /api/stats", () => {
  beforeEach(() => {
    seedTestData(db);
  });

  it("GET /api/stats returns dashboard data", async () => {
    const res = await fetch(`${baseUrl}/api/stats`);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.gesamt).toBe(3);
    expect(data.verfuegbar).toBe(1);
    expect(data.reserviert).toBe(1);
    expect(data.verkauft).toBe(1);
    expect(data.nach_typ).toBeDefined();
  });
});
