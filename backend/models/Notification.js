const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  rollNo: String,
  role: String,
  message: String,
  isRead: {
    type: Boolean,
    default: false
  },
  marksId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Marks"
},
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Notification", notificationSchema);