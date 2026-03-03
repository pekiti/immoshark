import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/error.js";
import { immobilienRouter } from "./routes/immobilien.js";
import { csvRouter } from "./routes/csv.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/immobilien", immobilienRouter);
app.use("/api/csv", csvRouter);
app.use("/api/stats", (await import("./routes/immobilien.js")).statsRouter);

app.use(errorHandler);

export { app };
