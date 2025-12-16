const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const attendanceRoutes = require("./routes/attendance");
const summaryRoutes = require("./routes/summary");
const adminRoutes = require("./routes/admin");
const { apiLimiter, authLimiter } = require("./middleware/rateLimiter");

const app = express();

/**
 * Required for Firebase / Cloud Functions
 * so rate-limit and IP detection work correctly
 */
app.set("trust proxy", 1);

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Apply rate limiting
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/admin", adminRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
