const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Marks = require("../models/Marks");
const verifyToken = require("../middleware/verifyToken");

router.get("/marks", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "parent")
      return res.status(403).json({ msg: "Access denied" });

    const parent = await User.findById(req.user.id);
    const studentIds = parent.studentIds;

    const marks = await Marks.find({ studentId: { $in: studentIds } });
    res.json(marks);
  } catch (error) {
    res.status(500).json({ msg: "Server Error" });
  }
});

module.exports = router;
