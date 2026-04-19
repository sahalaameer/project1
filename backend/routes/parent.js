const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Marks = require("../models/Marks");
const verifyToken = require("../middleware/verifyToken");

router.get("/marks", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "parent")
      return res.status(403).json({ msg: "Access denied" });

    // get parent info and student IDs
    const parent = await User.findById(req.user.id);
    if (!parent || parent.studentIds.length === 0) {
      return res.json([]);
    }

    // get rollNo of first linked student (or loop if multiple)
    const student = await User.findById(parent.studentIds[0]);

    if (!student) return res.json([]);

    // fetch marks by rollNo
    const marks = await Marks.find({ rollNo: student.rollNo });

    res.json(marks);

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;