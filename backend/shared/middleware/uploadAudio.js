const multer = require("multer");

function fileFilter(req, file, cb) {
  if (file.mimetype && file.mimetype.startsWith("audio/")) {
    cb(null, true);
  } else {
    cb(new Error("Only audio files are allowed"));
  }
}

const uploadAudio = multer({
  storage: multer.memoryStorage(), // forwarded straight to the transcription API, never written to disk
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB — plenty for a short voice note
});

module.exports = uploadAudio;