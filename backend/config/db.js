const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/samsthe_db";

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      retryWrites: true,
    });
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;