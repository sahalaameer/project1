const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const puppeteer = require("puppeteer");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const verifyToken = require("../middleware/verifyToken");
const Marks = require("../models/Marks");

const Notification = require("../models/Notification");

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Upload Excel
router.post(
  "/upload-marks",
  verifyToken,
  upload.single("file"),
  async (req, res) => {
    try {
      if (req.user.role !== "faculty") {
        return res.status(403).json({ message: "Access denied" });
      }

      const type = Array.isArray(req.body.type) ? req.body.type[0] : req.body.type;
      const course = Array.isArray(req.body.course) ? req.body.course[0] : req.body.course;
      const batch = Array.isArray(req.body.batch) ? req.body.batch[0] : req.body.batch;
      const semester = Array.isArray(req.body.semester) ? req.body.semester[0] : req.body.semester;

      if (!type || !course || !batch || !semester) {
        return res.status(400).json({ msg: "Course, Batch and Semester required" });
      }

      const workbook = xlsx.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(sheet);

     for (const row of data) {

  const subjectsMap = new Map();

  for (const key in row) {
    if (key !== "rollNo" && key !== "name") {
      const value = Number(row[key]);
      subjectsMap.set(key.trim(), isNaN(value) ? 0 : value);
    }
  }

  // Save Marks
  await Marks.findOneAndUpdate(
    { rollNo: row.rollNo, type, course, batch, semester },
    {
      rollNo: row.rollNo,
      name: row.name,
      course,
      batch,
      semester,
      type,
      subjects: subjectsMap
    },
    { upsert: true, new: true }
  );

  // 🔔 CREATE NOTIFICATION
 // Notify student
const student = await require("../models/User").findOne({
  rollNo: row.rollNo,
  role: "student"
});

if (student) {

  // Notify student
  await Notification.create({
  userId: student._id,
  rollNo: student.rollNo,
  role: "student",
  type: "MARKS_UPLOADED",
  message: "Your marks have been uploaded"
});

  // Notify parent
  const parents = await require("../models/User").find({
    role: "parent",
    studentIds: student._id
  });

  for (let parent of parents) {
     await Notification.create({
    userId: parent._id,
    rollNo: student.rollNo,
    role: "parent",
    type: "MARKS_UPLOADED",
    message: "Your child's marks have been uploaded"
  });
}
}


}

      res.json({ msg: "Marks uploaded successfully", fileSaved: req.file.filename });

    } catch (error) {
      console.error(error);
      res.status(500).json({ msg: "Upload failed" });
    }
  }
);

// Generate PDF report
router.get("/generate-report/:type/:course/:batch/:semester", verifyToken, async (req, res) => {
  const QuickChart = require("quickchart-js");

  try {
    const { type, course, batch, semester } = req.params;

    const students = await Marks.find({ type, course, batch, semester });

    if (students.length === 0) return res.status(404).json({ msg: "No data found" });

    const prevSem = Number(semester) - 1;
    let prevStudents = [];

    if (prevSem > 0) {
      prevStudents = await Marks.find({ type, course, batch, semester: prevSem.toString() });
    }

    let passMark = type === "internal" ? 20 : type === "model" ? 35 : 15;

    const totalStudents = students.length;
    let passCount = 0, failCount = 0;
    let subjectTotals = {}, subjectFailCount = {};
    let studentTotals = [], failedStudents = [];

    students.forEach(student => {
      let overallPass = true, total = 0, failedSub = [];
      const subjects = student.subjects instanceof Map ? student.subjects : new Map(Object.entries(student.subjects));

      subjects.forEach((mark, subject) => {
        total += mark;
        subjectTotals[subject] = (subjectTotals[subject] || 0) + mark;
        subjectFailCount[subject] = (subjectFailCount[subject] || 0);
        if (mark < passMark) {
          overallPass = false;
          failedSub.push(subject);
          subjectFailCount[subject]++;
        }
      });

      studentTotals.push({ name: student.name, rollNo: student.rollNo, total });

      if (overallPass) passCount++;
      else failCount++, failedStudents.push({ rollNo: student.rollNo, name: student.name, subjects: failedSub.join(", ") });
    });

    const passPercent = ((passCount / totalStudents) * 100).toFixed(2);
    const failPercent = ((failCount / totalStudents) * 100).toFixed(2);

    let mostFailedSubject = "-", maxFail = 0;
    for (const sub in subjectFailCount) {
      if (subjectFailCount[sub] > maxFail) maxFail = subjectFailCount[sub], mostFailedSubject = sub;
    }

    // Previous semester pass %
    let prevPassCount = 0;
    prevStudents.forEach(student => {
      let overallPass = true;
      const subjects = student.subjects instanceof Map ? student.subjects : new Map(Object.entries(student.subjects));
      subjects.forEach(mark => { if (mark < passMark) overallPass = false; });
      if (overallPass) prevPassCount++;
    });
    const prevPassPercent = prevStudents.length ? ((prevPassCount / prevStudents.length) * 100).toFixed(2) : 0;

    const subjectNames = Object.keys(subjectTotals);
    const subjectAvg = subjectNames.map(s => (subjectTotals[s] / totalStudents).toFixed(2));

    studentTotals.sort((a, b) => b.total - a.total);
    let toppers = studentTotals.slice(0, 5);
    let rank = 1, prevTotal = null;
    toppers = toppers.map((s, i) => {
      if (prevTotal !== null && s.total < prevTotal) rank = i + 1;
      prevTotal = s.total;
      return { rank, ...s };
    });

    // Charts
    const pie = new QuickChart();
    pie.setConfig({ type: 'pie', data: { labels: ['Pass', 'Fail'], datasets: [{ data: [passCount, failCount], backgroundColor: ['#2ecc71', '#e74c3c'] }] } });
    const subjectChart = new QuickChart();
    subjectChart.setConfig({ type: 'bar', data: { labels: subjectNames, datasets: [{ label: 'Average Marks', data: subjectAvg }] } });
    const semChart = new QuickChart();
    semChart.setConfig({ type: 'bar', data: { labels: [`Sem ${prevSem}`, `Sem ${semester}`], datasets: [{ label: 'Pass Percentage', data: [prevPassPercent, passPercent] }] } });

   const html = `
<html>
<head>
  <style>
    @page { margin: 50px; }
    body { font-family: Arial, sans-serif; margin: 0; font-size: 12px; line-height: 1.4; }
    
    /* Elaborate border */
    .page-border {
  position: fixed;
  top: 15px;
  left: 15px;
  right: 15px;
  bottom: 15px;
  border: 3px solid #000;
  padding: 25px;  /* ↑ increase padding so headings stay inside */
  border-radius: 8px;
  box-sizing: border-box;
  z-index: -1;
}

.container {
  padding: 60px 30px 30px 30px;  /* ↑ increase top padding so first headings inside border */
}

    h1 { text-align: center; font-size: 20px; margin-bottom: 10px; font-weight: bold; }
  h2 {
  font-size: 16px;
  margin-top: 50px;   /* increase from 40px */
  margin-bottom: 10px;
  border-bottom: 2px solid #000;
  width: fit-content;
  padding-bottom: 3px;
}

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-top: 10px;
      margin-bottom: 20px;
    }

    th, td { border: 1px solid #000; padding: 6px 8px; text-align: center; vertical-align: middle; }
    th { background-color: #f2f2f2; }

    .section {
  page-break-inside: avoid;
  margin-top: 30px;
  padding-top: 20px;
}
    .chart-row { display: flex; justify-content: space-around; gap: 20px; flex-wrap: wrap; margin-top: 20px; }
    .chart-row div { text-align: center; }
    img { display: block; margin: 10px auto; }

    /* Semester comparison on new page */
    .sem-comparison { page-break-before: always; margin-top: 40px; text-align: center; }

    footer { position: fixed; bottom: 10px; left: 0; right: 0; text-align: center; font-size: 10px; }
  </style>
</head>

<body>
  <div class="page-border"></div>
  <div class="container">
    <h1>ACADEMIC RESULT ANALYSIS REPORT</h1>
    <p><b>Course:</b> ${course}</p>
    <p><b>Batch:</b> ${batch}</p>
    <p><b>Semester:</b> ${semester}</p>
    <p><b>Exam Type:</b> ${type}</p>

    <div class="section">
      <h2>Summary</h2>
      <table>
        <tr><th>Total Students</th><th>Passed</th><th>Failed</th><th>Pass %</th><th>Fail %</th></tr>
        <tr><td>${totalStudents}</td><td>${passCount}</td><td>${failCount}</td><td>${passPercent}</td><td>${failPercent}</td></tr>
      </table>
      <p><b>Most Failed Subject:</b> ${mostFailedSubject}</p>
    </div>

    <div class="section">
      <h2>Top 5 Performers</h2>
      <table>
        <tr><th>Rank</th><th>Roll No</th><th>Name</th><th>Total</th></tr>
        ${toppers.map(t => `<tr><td>${t.rank}</td><td>${t.rollNo}</td><td>${t.name}</td><td>${t.total}</td></tr>`).join("")}
      </table>
    </div>

    <div class="section">
      <h2>Failed Students</h2>
      <table>
        <tr><th>Roll No</th><th>Name</th><th>Failed Subjects</th></tr>
        ${failedStudents.length === 0
          ? `<tr><td colspan="3">No failed students</td></tr>`
          : failedStudents.map(s => `<tr><td>${s.rollNo}</td><td>${s.name}</td><td>${s.subjects}</td></tr>`).join("")}
      </table>
    </div>

   <div class="section">
  <h2>Charts</h2>

  <div style="text-align:center; margin-top:20px;">
    <h3>Pass vs Fail</h3>
    <img src="${pie.getUrl()}" width="420">
  </div>

  <div style="text-align:center; margin-top:40px;">
    <h3>Subject Performance</h3>
    <img src="${subjectChart.getUrl()}" width="500">
  </div>

</div>

    <!-- Semester Comparison new page -->
    <div class="sem-comparison">
      <h2>Semester Comparison</h2>
      <img src="${semChart.getUrl()}" width="400">
    </div>
  </div>

  <footer>Page <span class="pageNumber"></span></footer>
</body>
</html>
`;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "50px", bottom: "50px", left: "30px", right: "30px" },
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `<div style="width:100%; text-align:center; font-size:10px;"><span class="pageNumber"></span></div>`,
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${type}_analysis.pdf`
    });

    res.send(pdf);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Report generation failed" });
  }
});
router.post("/upload-attendance", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "Please select an Excel file" });
    }

    const { course, batch, semester } = req.body;

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    for (const row of rows) {
      const rollNo = row.RollNo || row.rollNo;
      const name = row.Name || row.name;
      const month = row.Month || row.month;
      const workingDays = row.WorkingDays || row.workingDays;
      const presentDays = row.PresentDays || row.presentDays;
      const percentage = row.Percentage || row.percentage;

      // Save attendance
      await Attendance.create({
        rollNo,
        name,
        month,
        workingDays,
        presentDays,
        percentage,
        course,
        batch,
        semester
      });

      // Find student
      const student = await User.findOne({
        rollNo,
        role: "student"
      });

      if (student) {
        // Notify student
       await Notification.create({
  userId: student._id,
  message: `Attendance uploaded for April: ${percentage}%`,
  type: "ATTENDANCE_UPLOADED"
});

        // Notify parents linked to student
        const parents = await User.find({
          role: "parent",
          studentIds: student._id
        });

        for (const parent of parents) {
         await Notification.create({
  userId: parent._id,
  message: `${student.rollNo}'s attendance for ${month}: ${percentage}%`,
  type: "ATTENDANCE_UPLOADED"
});
        }
      }
    }

    res.json({ msg: "Attendance uploaded successfully" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Upload failed" });
  }
});

module.exports = router;