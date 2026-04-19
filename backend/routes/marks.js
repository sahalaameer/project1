const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const Marks = require("../models/Marks");
const verifyToken = require("../middleware/verifyToken");
const User = require("../models/User");
const Notification = require("../models/Notification");

// multer config
const upload = multer({ dest: "uploads/" });

// UPLOAD EXCEL
router.post("/upload", verifyToken, upload.single("file"), async (req, res) => {
  try {
    // only teacher/admin allowed
    if (req.user.role !== "teacher" && req.user.role !== "admin") {
      return res.status(403).json({ msg: "Access denied" });
    }

    if (!req.file) {
      return res.status(400).json({ msg: "No file uploaded" });
    }

    // read excel
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    /*
      EXCEL FORMAT 👇
      studentId | subject | marks
    */

    const savedMarks = [];

for (let item of data) {
  const mark = await Marks.create(item);
  savedMarks.push(mark);
}

// send notifications
for (let mark of savedMarks) {

  const student = await User.findOne({
    rollNo: mark.rollNo,
    role: "student"
  });

  if (!student) continue;

  await Notification.create({
    rollNo: student.rollNo,
    role: "student",
    type: "MARKS_UPLOADED",
    message: "Your marks have been uploaded",
    marksId: mark._id   // ✅ REAL LINK
  });

  const parents = await User.find({
    role: "parent",
    studentIds: student._id
  });

  for (let parent of parents) {
    await Notification.create({
      rollNo: student.rollNo,
      role: "parent",
      type: "MARKS_UPLOADED",
      message: "Your child's marks have been uploaded",
      marksId: mark._id   // ✅ REAL LINK
    });
  }
}

    res.json({ msg: "Excel uploaded, marks saved & notifications sent" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// GET marks for student
router.get("/:examType/:rollNo", async (req, res) => {
  try {

    const { examType, rollNo } = req.params;

    const marks = await Marks.find({
      rollNo: rollNo,
      type: examType
    });

    res.json(marks);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching marks" });
  }
});
router.get("/id/:id", async (req, res) => {
  try {
    const marks = await Marks.findById(req.params.id);
    res.json(marks);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching marks" });
  }
});
module.exports = router;
