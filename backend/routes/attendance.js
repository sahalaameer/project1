const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const Attendance = require("../models/Attendance");

router.get("/student", verifyToken, async (req, res) => {
  try {
    const data = await Attendance.find({
      rollNo: req.user.rollNo
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching attendance" });
  }
});
const User = require("../models/User");

router.get("/parent", verifyToken, async (req, res) => {
  try {
    const parent = await User.findById(req.user.id).populate("studentIds");

    const rollNos = parent.studentIds.map(s => s.rollNo);

    const data = await Attendance.find({
      rollNo: { $in: rollNos }
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching attendance" });
  }
});
module.exports = router;