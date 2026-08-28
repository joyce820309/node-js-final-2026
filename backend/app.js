const express = require("express");
const cors = require("cors");

const hcRouter = require("./routes/healthcheck");
const coachesRouter = require("./routes/coaches");
const creditPackageRouter = require("./routes/credit-package");
const usersRouter = require("./routes/users");
const adminCoachesRouter = require("./routes/admin-coaches")
// const adminCoursesRouter = require("./routes/admin-courses")

const { initDb } = require("./config/initDb");

const app = express();

app.use(cors());
app.use(express.json());
app.use(hcRouter);
app.use("/api", coachesRouter);
app.use("/api", usersRouter);
app.use("/api", creditPackageRouter);
app.use("/api", adminCoachesRouter);
// app.use("/api", adminCoursesRouter);

initDb().catch((err) => {
  console.error("Database initialization failed:", err.message);
});

app.use((req, res) =>
  res.status(404).json({ status: "failed", message: "Not Found" }),
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ status: "failed", message: err.message });
});

module.exports = app;
