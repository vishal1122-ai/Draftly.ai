// server/routes/review.js
const router = require("express").Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const { reviewController } = require("../controllers/reviewController");

// multipart/form-data: file, docType
router.post("/", upload.single("file"), reviewController);

module.exports = router;
