const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 Connect to MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/mydb")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error: ", err));


// 🔥 User routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

const parentRoutes = require("./routes/parent");
app.use("/api/parent", parentRoutes);


// Server Start
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
