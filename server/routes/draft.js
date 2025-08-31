// server/routes/draft.js
const router = require("express").Router();
const { draftController } = require("../controllers/draftController");

// POST /api/draft
router.post("/", draftController);

module.exports = router;
