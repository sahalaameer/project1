const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  rollNo: String,
  name: String,
  month: String,
  workingDays: Number,
  presentDays: Number,
  percentage: Number,
  course: String,
  batch: String,
  semester: String
});

module.exports = mongoose.model("Attendance", attendanceSchema);