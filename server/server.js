// server/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const draftRouter = require("./routes/draft");
const reviewRouter = require("./routes/review");
const app = express();

// --- middleware ---
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use("/api/draft", draftRouter);
app.use("/api/review", reviewRouter);

// --- health check (so you can verify the server runs) ---
app.get("/health", (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || "dev" });
});

// --- API routes (wire these AFTER you create the files) ---
// const draftRouter = require("./routes/draft");
// const reviewRouter = require("./routes/review");
// app.use("/api/draft", draftRouter);
// app.use("/api/review", reviewRouter);

// --- start server ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`[server] listening on http://localhost:${PORT}`)
);
