const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// REGISTER
router.post("/register", async (req, res) => {
  try {

    const { email, password, role, rollNo, studentEmail } = req.body;
 const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // ✅ PASSWORD STRENGTH CHECK (basic)
    if (password.length < 3) {
      return res.status(400).json({ message: "Password too short (min 3 chars)" });
    }
    // ✅ CHECK IF USER ALREADY EXISTS
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
 
    let studentIds = [];

    // If parent registering, connect to student using studentEmail
    if (role === "parent" && studentEmail) {

      const student = await User.findOne({
        email: studentEmail,
        role: "student"
      });

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      studentIds.push(student._id);
    }

    const newUser = new User({
      email,
      password,
      role,
      rollNo,
      studentIds
    });

    await newUser.save();

    res.status(201).json({ message: "User created successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🔴 Check empty fields
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });

    // 🔴 User not found
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔴 Password incorrect
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // ✅ Success
    const token = jwt.sign(
      { id: user._id, role: user.role, rollNo: user.rollNo },
      "secretkey",
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successful",
      token: token,
      rollNo: user.rollNo,
      role: user.role
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
