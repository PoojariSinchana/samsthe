require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");   
const { startTableCleanupJob } = require("./modules/restaurant/jobs/tableCleanupJob")
const { startTaskReminderJob } = require("./shared/jobs/taskReminderJob");
const { startSubscriptionSweepJob } = require("./shared/jobs/subscriptionSweepJob");
const { startSettingsRefresh } = require("./modules/admin/utils/settings");
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Samsthe API running on http://localhost:${PORT}`);
  });
  startSettingsRefresh();
  startTableCleanupJob();
  startTaskReminderJob();
  startSubscriptionSweepJob();
});