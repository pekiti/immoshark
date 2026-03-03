import { Router } from "express";
import {
  immobilieCreateSchema,
  immobilieUpdateSchema,
  immobilienFilterSchema,
} from "@immoshark/shared";
import { validate } from "../middleware/validate.js";
import * as service from "../services/immobilien.service.js";

export const immobilienRouter = Router();
export const statsRouter = Router();

// GET /api/immobilien — list with filters + FTS search
immobilienRouter.get("/", validate(immobilienFilterSchema, "query"), (_req, res) => {
  const result = service.listImmobilien(res.locals.query);
  res.json(result);
});

// GET /api/immobilien/:id — detail with bilder
immobilienRouter.get("/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: { message: "Ungültige ID", code: "INVALID_ID" } });
    return;
  }
  const immobilie = service.getImmobilie(id);
  if (!immobilie) {
    res.status(404).json({ error: { message: "Nicht gefunden", code: "NOT_FOUND" } });
    return;
  }
  res.json({ data: immobilie });
});

// POST /api/immobilien — create
immobilienRouter.post("/", validate(immobilieCreateSchema), (req, res) => {
  const immobilie = service.createImmobilie(req.body);
  res.status(201).json({ data: immobilie });
});

// PUT /api/immobilien/:id — update
immobilienRouter.put("/:id", validate(immobilieUpdateSchema), (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: { message: "Ungültige ID", code: "INVALID_ID" } });
    return;
  }
  const immobilie = service.updateImmobilie(id, req.body);
  if (!immobilie) {
    res.status(404).json({ error: { message: "Nicht gefunden", code: "NOT_FOUND" } });
    return;
  }
  res.json({ data: immobilie });
});

// DELETE /api/immobilien/:id
immobilienRouter.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: { message: "Ungültige ID", code: "INVALID_ID" } });
    return;
  }
  const deleted = service.deleteImmobilie(id);
  if (!deleted) {
    res.status(404).json({ error: { message: "Nicht gefunden", code: "NOT_FOUND" } });
    return;
  }
  res.status(204).send();
});

// GET /api/stats — dashboard
statsRouter.get("/", (_req, res) => {
  const stats = service.getStats();
  res.json({ data: stats });
});
