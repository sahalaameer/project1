const mongoose = require("mongoose");

const marksSchema = new mongoose.Schema({
  rollNo: {
    type: String,
    required: true
  },

   name: {                 // 👈 ADD THIS BLOCK
    type: String,
    required: true
  },
  course: {                // 👈 NEW
    type: String,
    required: true
  },

  batch: {                 // 👈 NEW
    type: String,
    required: true
  },

  semester: {              // 👈 NEW
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ["internal", "model", "final", "attendance"],
    required: true
  },

  subjects: {
    type: Map,
    of: Number
  },
uploadedAt: {           // 👈 GOOD FOR RECORD
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Marks", marksSchema);
