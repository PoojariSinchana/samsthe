require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

for (const dir of ["shared/models", "modules/admin/models", "modules/restaurant/models"]) {
  const full = path.join(__dirname, "..", dir);
  for (const f of fs.readdirSync(full)) if (f.endsWith(".js")) require(path.join(full, f));
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const m of Object.values(mongoose.models)) {
    try { await m.syncIndexes(); console.log("synced", m.modelName); }
    catch (e) { console.error("FAILED", m.modelName, e.message); }
  }
  await mongoose.disconnect();
})();