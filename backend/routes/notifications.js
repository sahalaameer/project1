const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");

router.get("/", verifyToken, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "student") {
      filter = {
  $or: [
    { rollNo: req.user.rollNo, role: "student" },
    { userId: req.user.id }
  ]
};
    }

    if (req.user.role === "parent") {
      const parent = await User.findById(req.user.id).populate("studentIds");
      const student = parent.studentIds[0];

      filter = {
  $or: [
    { rollNo: student.rollNo, role: "parent" },
    { userId: req.user.id }
  ]
};
    }

    const notifications = await Notification.find(filter).sort({ createdAt: -1 });

    res.json(notifications);

  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Error fetching notifications" });
  }
});
// GET all notifications for student
router.put("/read-all", verifyToken, async (req, res) => {
  try {

    let filter = {};

    if (req.user.role === "student") {
      filter = {
  $or: [
    { rollNo: req.user.rollNo, role: "student" },
    { userId: req.user.id }
  ]
};
    }

    if (req.user.role === "parent") {
      const parent = await User.findById(req.user.id).populate("studentIds");
      const student = parent.studentIds[0];

     filter = {
  $or: [
    { rollNo: student.rollNo, role: "parent" },
    { userId: req.user.id }
  ]
};
    }

    await Notification.updateMany(filter, { isRead: true });

    res.json({ msg: "All marked as read" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Error updating notifications" });
  }
});


// MARK notification as read
router.put("/read/:id", verifyToken, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true }
    );

    res.json({ msg: "Marked as read" });
  } catch (err) {
    res.status(500).json({ msg: "Error updating notification" });
  }
});

// MARK ALL notifications as read

module.exports = router;