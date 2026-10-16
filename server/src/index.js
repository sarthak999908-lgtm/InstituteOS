const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to InstituteOS Backend 🚀",
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend is running successfully!",
  });
});

// Dashboard API
app.get("/api/dashboard", (req, res) => {
  res.json({
    success: true,
    data: {
      totalStudents: 1248,
      activeBatches: 24,
      attendancePercentage: 87.5,
      pendingFees: 125000,
      overdueInstalments: 18,
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 InstituteOS backend running at http://localhost:${PORT}`);
});