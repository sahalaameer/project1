const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");

const reportsDir = path.join(__dirname, "../reports");
const PDFDocument = require("pdfkit");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const upload = multer({ dest: "uploads/" });
const ChartDataLabels = require('chartjs-plugin-datalabels');
const chartJS = new ChartJSNodeCanvas({ width: 1200, height: 600 });
const PptxGenJS = require("pptxgenjs");
let excelData = [];
let metaData = {};

// ==============================
// 📥 UPLOAD EXCEL
// ==============================
function drawBorder(doc) {
  const m = 20;
  doc.rect(
    m,
    m,
    doc.page.width - m * 2,
    doc.page.height - m * 2
  ).stroke();
}
router.post("/upload-excel", upload.single("file"), (req, res) => {

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
const raw = xlsx.utils.sheet_to_json(sheet, {
  header: 1
});

// ✅ REAL HEADER ROW (Row index 5)
const headers = raw[5];

// Force first two headers
headers[0] = "SL_No";   // optional
headers[1] = "PRN";     // correct
headers[2] = "Name";    // correct

const rows = raw.slice(6);

// ✅ CONVERT TO JSON
const data = rows.map(row => {
  let obj = {};
  headers.forEach((h, i) => {
    obj[h] = row[i];
  });
  return obj;
});

excelData = data;

// 🧪 DEBUG
// console.log("CLEAN DATA 👉", excelData[0]);

    excelData = data;
 // 🧪 DEBUG LINE (ADD THIS)
    // console.log("FIRST ROW DATA 👉", excelData[0]);
    metaData = {
      course: req.body.course,
      batch: req.body.batch,
      semester: req.body.semester,
      facultyName: req.body.facultyName,
      subjectName: req.body.subjectName,
      remarks: req.body.remarks
    };

    res.json({ msg: "Excel uploaded successfully" });

  } catch (err) {
    res.status(500).json({ msg: "Excel processing failed" });
  }

});
function generateAnalysis(excelData) {

  const sample = excelData[0];
  const subjects = [];

  Object.keys(sample).forEach(key => {
    if (key.endsWith("_Tot")) {
      subjects.push(key.replace("_Tot", ""));
    }
  });

  let subjectStats = {};
  let failureBreakdown = {};
  let gradeCount = {};
  let passCount = 0;
  let failCount = 0;

  subjects.forEach(sub => {
    subjectStats[sub] = { pass: 0, fail: 0, absent: 0, total: 0 };

    failureBreakdown[sub] = {
      intFail: 0,
      extFail: 0,
      totalFail: 0
    };
  });

  let toppers = [];

  excelData.forEach(student => {

    const studentName =
      student["Name"]?.toString().trim() ||
      student["NAME"]?.toString().trim() ||
      "Unknown";

    const sgpa = Number(student["Sem_SGPA"]) || 0;
    const total = Number(student["Sem_Total"]) || 0;

    if ((student["Sem_Result"] || "").toString().trim().toUpperCase() === "P")
      passCount++;
    else failCount++;

    gradeCount[student["Sem_Grade"] || "Unknown"] =
      (gradeCount[student["Sem_Grade"] || "Unknown"] || 0) + 1;

    toppers.push({
      name: studentName,
      sgpa,
      total,
      grade: student["Sem_Grade"] || "-"
    });
toppers.sort((a, b) => {
  if (b.sgpa !== a.sgpa) return b.sgpa - a.sgpa;
  return b.total - a.total;
});

    subjects.forEach(sub => {

      const isa = Number(student[sub + "_ISA"]) || 0;
      const esa = Number(student[sub + "_ESA"]) || 0;
      const res = (student[sub + "_Res"] || "").toString().toUpperCase();

      const totalMarks = isa + esa;

      if (res === "F") {
        subjectStats[sub].fail++;
      } else {
        subjectStats[sub].pass++;
      }

      subjectStats[sub].total++;

      if (totalMarks < 35) failureBreakdown[sub].totalFail++;
      if (isa < 6) failureBreakdown[sub].intFail++;
      if (esa < 24) failureBreakdown[sub].extFail++;
    });
  });

  return {
    subjects,
    subjectStats,
    failureBreakdown,
    gradeCount,
    passCount,
    failCount,
    toppers
  };
}
// ==============================
// 📊 GENERATE FULL REPORT
// ==============================
router.get("/generate-full/:course/:batch/:semester", async (req, res) => {

  try {

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader("Content-Type", "application/pdf");
    const fileName = `result_${Date.now()}.pdf`;
const filePath = path.join(reportsDir, fileName);

const stream = fs.createWriteStream(filePath);
doc.pipe(stream);

    const totalStudents = excelData.length;

   const analysis = generateAnalysis(excelData);

const {
  subjects,
  subjectStats,
  failureBreakdown,
  gradeCount,
  passCount,
  failCount,
  toppers
} = analysis;
const passPercent = totalStudents ? ((passCount / totalStudents) * 100).toFixed(2) : 0;
//  

    // ================= TITLE =================
    doc.fontSize(18).text("ACADEMIC ANALYSIS REPORT", { align: "center" });
    doc.moveDown();

    doc.text(`Course: ${metaData.course}`);
    doc.text(`Batch: ${metaData.batch}`);
    doc.text(`Semester: ${metaData.semester}`);
    doc.moveDown();

    doc.moveDown();
doc.fontSize(14).text("Summary Table", { underline: true });
doc.moveDown();
drawBorder(doc);
// Table layout
const startX = 50;
let startY = doc.y;

const col1Width = 250;
const col2Width = 200;
const rowHeight = 25;

// Header
doc.rect(startX, startY, col1Width, rowHeight).stroke();
doc.rect(startX + col1Width, startY, col2Width, rowHeight).stroke();

doc.text("Parameter", startX + 10, startY + 7);
doc.text("Value", startX + col1Width + 10, startY + 7);

startY += rowHeight;

// Table rows data
const tableData = [
  ["Total Students", totalStudents],
  ["Students Passed", passCount],
  ["Students Failed", failCount],
  ["Pass Percentage (%)", passPercent]
];

// Draw rows
tableData.forEach(row => {
  doc.rect(startX, startY, col1Width, rowHeight).stroke();
  doc.rect(startX + col1Width, startY, col2Width, rowHeight).stroke();

  doc.text(row[0], startX + 10, startY + 7);
  doc.text(String(row[1]), startX + col1Width + 10, startY + 7);

  startY += rowHeight;
});
    
   

    // ================= SUBJECT ANALYSIS =================
    doc.addPage();
   

drawBorder(doc);

doc.fontSize(14).text("Subject Wise Analysis", { underline: true, align: "center" });
doc.moveDown();

// TABLE HEADERS
const tableX = 40;
let tableY = doc.y;

const colWidths = [120, 70, 60, 60, 70, 70];
const headers = ["Subject", "Appeared", "Pass", "Fail", "Absent", "Pass %"];

// DRAW HEADER
let x = tableX;
headers.forEach((h, i) => {
  doc.rect(x, tableY, colWidths[i], 25).stroke();
  doc.text(h, x + 5, tableY + 7);
  x += colWidths[i];
});

tableY += 25;

// DATA ROWS
let subLabels = [];
let passPercentData = [];

subjects.forEach(sub => {
  const stat = subjectStats[sub];

  const appeared = stat.total;
  const pass = stat.pass;
  const fail = stat.fail;
  const absent = stat.absent;

  const passP = appeared ? ((pass / appeared) * 100).toFixed(2) : 0;

  subLabels.push(sub);
  passPercentData.push(Number(passP));

  let row = [sub, appeared, pass, fail, absent, passP];

  let x = tableX;
  row.forEach((cell, i) => {
    doc.rect(x, tableY, colWidths[i], 25).stroke();
    doc.text(String(cell), x + 5, tableY + 7);
    x += colWidths[i];
  });

  tableY += 25;
});

doc.moveDown(3);
// 🔥 PREPARE FULL DATA
const appearedData = [];
const passData = [];
const failData = [];
const absentData = [];


subjects.forEach(sub => {
  const stat = subjectStats[sub];

  const appeared = stat.total;
  const pass = stat.pass;
  const fail = stat.fail;
  const absent = stat.absent;

  const passP = appeared ? ((pass / appeared) * 100).toFixed(2) : 0;

 appearedData.push(appeared);
passData.push(pass);
failData.push(fail);
absentData.push(absent);

});


// 🔥 NEW GRAPH (MATCHES YOUR IMAGE)
const subjectChart = await chartJS.renderToBuffer({
  type: "bar",
  data: {
    labels: subLabels,
    datasets: [
  {
    label: "Appeared",
    data: appearedData,
    backgroundColor: "#4e73df",
     barPercentage: 0.6,
  categoryPercentage: 0.6
  },
  {
    label: "Pass",
    data: passData,
    backgroundColor: "#2ecc71",
     barPercentage: 0.6,
  categoryPercentage: 0.6
  },
  {
    label: "Fail",
    data: failData,
    backgroundColor: "#e74a3b",
     barPercentage: 0.6,
  categoryPercentage: 0.6
  },
  {
    label: "Absent",
    data: absentData,
    backgroundColor: "#858796",
     barPercentage: 0.6,
  categoryPercentage: 0.6
  },
  {
    label: "Pass %",
    data: passPercentData,
    backgroundColor: "#36A2EB",
     barPercentage: 0.6,
  categoryPercentage: 0.6
       // ⭐ VERY IMPORTANT
  }
]
},
  options: {
    layout: {
  padding: {
    left: 30,
    right: 30,
    top: 70,
    bottom: 10
  }
},
   plugins: {
  legend: {
  position: "right",
  align: "center",
  labels: {
    padding: 25
  }
},
  datalabels: {
  formatter: (value, context) => {
    if (context.dataset.label === "Pass %") {
      return value + "%";
    }
    return value;
  },
  anchor: "end",
  align: "top",
  font: {
     size: 12,
     weight:"bold" 
    }
}
    },

scales: {
  y: {
    beginAtZero: true,
    max: 100,
    title: {
      display: true,
      text: "Students / Pass %"
    }
  }
}
  },
  plugins: [ChartDataLabels]
});


// CENTER GRAPH
const chartWidth2 = 520;
const centerX2 = (doc.page.width - chartWidth2) / 2;

doc.image(subjectChart, centerX2, doc.y, {
  width: chartWidth2
});

    

    // 📊 SUBJECT PASS CHART
    

    // ================= FAILURE ANALYSIS =================
   doc.addPage();
drawBorder(doc);

doc.fontSize(14).text("Failure Analysis", { underline: true, align: "center" });
doc.moveDown();

// TABLE
const fx = 40;
let fy = doc.y;

const fWidths = [120, 80, 80, 100];
const fHeaders = ["Subject", "INT < 6", "EXT < 24", "TOTAL < 35"];

// HEADER
let tx = fx;
fHeaders.forEach((h, i) => {
  doc.rect(tx, fy, fWidths[i], 25).stroke();
  doc.text(h, tx + 5, fy + 7);
  tx += fWidths[i];
});

fy += 25;

// DATA
let intData = [];
let extData = [];
let totalFailData = [];

subjects.forEach(sub => {
  const data = failureBreakdown[sub];

  intData.push(data.intFail);
  extData.push(data.extFail);
  totalFailData.push(data.totalFail);

  let row = [sub, data.intFail, data.extFail, data.totalFail];

  let tx = fx;
  row.forEach((cell, i) => {
    doc.rect(tx, fy, fWidths[i], 25).stroke();
    doc.text(String(cell), tx + 5, fy + 7);
    tx += fWidths[i];
  });

  fy += 25;
});
doc.moveDown(3);

const failureChart = await chartJS.renderToBuffer({
  type: "bar",
  data: {
    labels: subLabels,
    datasets: [
      {
        label: "INT < 6",
        data: intData,
        backgroundColor: "#f39c12",
        barPercentage: 0.6,
        categoryPercentage: 0.6
      },
      {
        label: "EXT < 24",
        data: extData,
        backgroundColor: "#e74a3b",
        barPercentage: 0.6,
        categoryPercentage: 0.6
      },
      {
        label: "TOTAL < 35",
        data: totalFailData,
        backgroundColor: "#8e44ad",
        barPercentage: 0.6,
        categoryPercentage: 0.6
      }
    ]
  },
  options: {
    plugins: {
      legend: {
        position: "top"
      },
      datalabels: {
        anchor: "end",
        align: "top",
        font: {
            size: 14,        // 🔥 increase size
    
          weight: "bold"
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  },
  plugins: [ChartDataLabels]
});

// CENTER GRAPH
const chartWidthF = 520;
const centerXF = (doc.page.width - chartWidthF) / 2;

doc.image(failureChart, centerXF, doc.y, {
  width: chartWidthF
});

    // ================= ISA vs ESA =================
    // ================= INTERNAL vs EXTERNAL ANALYSIS =================
doc.addPage();
drawBorder(doc);

doc.fontSize(14).text("Internal vs External Analysis", {
  underline: true,
  align: "center"
});
doc.moveDown();

// STORE COUNTS
let scoreBand = {};
let totalBand = {};

subjects.forEach(sub => {
  totalBand[sub] = {
    t1: 0, // <35
    t2: 0, // 35-50
    t3: 0, // 50-65
    t4: 0, // 65-80
    t5: 0  // >80
  };
});
subjects.forEach(sub => {
  scoreBand[sub] = {
    int1: 0, // <10
    int2: 0, // 10-14
    int3: 0, // 15-20
    ext1: 0, // <50
    ext2: 0, // 50-64
    ext3: 0  // 65-80
  };
});

// PROCESS DATA
excelData.forEach(student => {
  subjects.forEach(sub => {
    const isa = Number(student[sub + "_ISA"]) || 0;
    const esa = Number(student[sub + "_ESA"]) || 0;

    // INT RANGE
    if (isa < 10) scoreBand[sub].int1++;
    else if (isa <= 14) scoreBand[sub].int2++;
    else scoreBand[sub].int3++;

    // EXT RANGE
    if (esa < 50) scoreBand[sub].ext1++;
    else if (esa <= 64) scoreBand[sub].ext2++;
    else scoreBand[sub].ext3++;
    const total = Number(student[sub + "_Tot"]) || 0;

// TOTAL RANGE
if (total < 35) totalBand[sub].t1++;
else if (total <= 50) totalBand[sub].t2++;
else if (total <= 65) totalBand[sub].t3++;
else if (total <= 80) totalBand[sub].t4++;
else totalBand[sub].t5++;
  });
});

// TABLE
const tableStartX = 35;
let ty = doc.y;

const widths = [80, 70, 70, 70, 70, 70, 70];

const heads = [
  "Subject",
  "INT <10",
  "10-14",
  "15-20",
  "EXT <50",
  "50-64",
  "65-80"
];

// HEADER
let px = tableStartX;
heads.forEach((h, i) => {
  doc.rect(px, ty, widths[i], 25).stroke();
  doc.fontSize(9).text(h, px + 5, ty + 8, { width: widths[i] });
  px += widths[i];
});

ty += 25;

// ROWS
subjects.forEach(sub => {
  const d = scoreBand[sub];

  const row = [
    sub,
    d.int1,
    d.int2,
    d.int3,
    d.ext1,
    d.ext2,
    d.ext3
  ];

  let px = tableStartX;
  row.forEach((cell, i) => {
    doc.rect(px, ty, widths[i], 25).stroke();
    doc.fontSize(9).text(String(cell), px + 5, ty + 8, {
      width: widths[i]
    });
    px += widths[i];
  });

  ty += 25;
});

doc.moveDown(3);

// GRAPH DATA
const int1 = subjects.map(s => scoreBand[s].int1);
const int2 = subjects.map(s => scoreBand[s].int2);
const int3 = subjects.map(s => scoreBand[s].int3);
const ext1 = subjects.map(s => scoreBand[s].ext1);
const ext2 = subjects.map(s => scoreBand[s].ext2);
const ext3 = subjects.map(s => scoreBand[s].ext3);

// GRAPH
const bandChart = await chartJS.renderToBuffer({
  type: "bar",
  data: {
    labels: subjects,
    datasets: [
      { label: "INT <10", data: int1, backgroundColor: "#e74a3b" },
      { label: "INT 10-14", data: int2, backgroundColor: "#f39c12" },
      { label: "INT 15-20", data: int3, backgroundColor: "#2ecc71" },
      { label: "EXT <50", data: ext1, backgroundColor: "#9b59b6" },
      { label: "EXT 50-64", data: ext2, backgroundColor: "#3498db" },
      { label: "EXT 65-80", data: ext3, backgroundColor: "#1abc9c" }
    ]
  },
  options: {
    plugins: {
      legend: {
        position: "top"
      },
      datalabels: {
        anchor: "end",
        align: "top",
        font: {
          weight: "bold",
          size: 10
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  },
  plugins: [ChartDataLabels]
});

// SHOW GRAPH
doc.image(bandChart, 35, ty + 20, {
  width: 520
});
// ================= TOTAL MARK ANALYSIS =================
doc.addPage();
drawBorder(doc);

doc.fontSize(14).text("Total Mark Analysis", {
  underline: true,
  align: "center"
});
doc.moveDown();

// TABLE
const tx1 = 25;
let ty1 = doc.y;

const tw = [80, 70, 70, 70, 70, 70];

const th = [
  "Subject",
  "total <35",
  "35-50",
  "50-65",
  "65-80",
  ">80"
];

// HEADER
let xx = tx1;
th.forEach((h, i) => {
  doc.rect(xx, ty1, tw[i], 25).stroke();
  doc.fontSize(9).text(h, xx + 5, ty1 + 8, { width: tw[i] });
  xx += tw[i];
});

ty1 += 25;

// ROWS
subjects.forEach(sub => {
  const d = totalBand[sub];

  const row = [
    sub,
    d.t1,
    d.t2,
    d.t3,
    d.t4,
    d.t5
  ];

  let xx = tx1;
  row.forEach((cell, i) => {
    doc.rect(xx, ty1, tw[i], 25).stroke();
    doc.fontSize(9).text(String(cell), xx + 5, ty1 + 8, {
      width: tw[i]
    });
    xx += tw[i];
  });

  ty1 += 25;
});

doc.moveDown(3);

// GRAPH DATA
const t1 = subjects.map(s => totalBand[s].t1);
const t2 = subjects.map(s => totalBand[s].t2);
const t3 = subjects.map(s => totalBand[s].t3);
const t4 = subjects.map(s => totalBand[s].t4);
const t5 = subjects.map(s => totalBand[s].t5);

// GRAPH
const totalChart = await chartJS.renderToBuffer({
  type: "bar",
  data: {
    labels: subjects,
    datasets: [
      { label: "<35", data: t1, backgroundColor: "#e74a3b" },
      { label: "35-50", data: t2, backgroundColor: "#f39c12" },
      { label: "50-65", data: t3, backgroundColor: "#3498db" },
      { label: "65-80", data: t4, backgroundColor: "#2ecc71" },
      { label: ">80", data: t5, backgroundColor: "#8e44ad" }
    ]
  },
  options: {
    plugins: {
      legend: {
        position: "top"
      },
      datalabels: {
        anchor: "end",
        align: "top",
        font: {
          size: 10,
          weight: "bold"
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  },
  plugins: [ChartDataLabels]
});

doc.image(totalChart, 35, ty1 + 20, {
  width: 520
});
    // ================= GRADE DISTRIBUTION =================
  
doc.addPage();
drawBorder(doc);
doc.fontSize(14).text("Grade vs Number of Students", { underline: true, align: "center" });
doc.moveDown();
doc.moveDown();

// FIXED GRADE ORDER
const gradeOrder = ["S","A+","A","B+","B","C","D","F"];

// TABLE POSITION
const startX2 = 50;
let startY2 = doc.y;

const colWidth2 = 60;
const rowHeight2 = 25;

// HEADER ROW
gradeOrder.forEach((grade, i) => {
  doc.rect(startX2 + (i * colWidth2), startY2, colWidth2, rowHeight2).stroke();
  doc.text(grade, startX2 + (i * colWidth2) + 15, startY2 + 7);
});

startY2 += rowHeight2;

// VALUE ROW
gradeOrder.forEach((grade, i) => {
  const count = gradeCount[grade] || 0;
  doc.rect(startX2 + (i * colWidth2), startY2, colWidth2, rowHeight2).stroke();
  doc.text(String(count), startX2 + (i * colWidth2) + 15, startY2 + 7);
});

doc.moveDown(3);

// 📊 BAR CHART (BETTER THAN PIE)
const gradeValues = gradeOrder.map(g => gradeCount[g] || 0);

const gradeBarChart = await chartJS.renderToBuffer({
  type: "bar",
  data: {
    labels: gradeOrder,
    datasets: [{
      label: "Number of Students",
      data: gradeValues,
       backgroundColor: "#4e73df" 
    }]
  },
  options: {
    plugins: {
      datalabels: {
        anchor: 'end',
        align: 'top',
        formatter: (value) => value,
        font: {
          weight: 'bold',
          size: 14
        }
      }
    }
  },
  plugins: [ChartDataLabels]
});


doc.moveDown(2);

const chartWidth = 400;
const pageWidth = doc.page.width;

const centerX = (pageWidth - chartWidth) / 2;

doc.image(gradeBarChart, centerX, doc.y, {
  width: chartWidth
});

    

    // ================= TOPPERS =================
  // ================= TOPPERS TABLE =================
doc.addPage();
drawBorder(doc);

doc.fontSize(14).text("Top 10 Students", {
  underline: true,
  align: "center"
});
doc.moveDown();

// TABLE POSITION
const topX = 30;
let topY = doc.y;

const topWidths = [50, 220, 80, 120, 70];

const topHeaders = [
  "Rank",
  "Name",
  "SGPA",
  "Total Marks",
  "Grade"
];

// HEADER
let hx = topX;
topHeaders.forEach((h, i) => {
  doc.rect(hx, topY, topWidths[i], 25).stroke();
  doc.fontSize(10).text(h, hx + 5, topY + 8, {
    width: topWidths[i],
    align: "center"
  });
  hx += topWidths[i];
});

topY += 25;

// DATA ROWS
let rank = 0;
let prevSGPA = null;
let prevTotal = null;

toppers.slice(0, 10).forEach((t) => {

  if (t.sgpa !== prevSGPA || t.total !== prevTotal) {
    rank++;
    prevSGPA = t.sgpa;
    prevTotal = t.total;
  }

  const sgpa = t.sgpa || "-";
  const total = t.total || "-";
  const grade = t.grade || "-";

  const row = [
    rank,
    t.name,
    sgpa,
    total,
    grade
  ];

  let dx = topX;

  row.forEach((cell, j) => {
    doc.rect(dx, topY, topWidths[j], 25).stroke();
    doc.fontSize(9).text(String(cell), dx + 5, topY + 8, {
      width: topWidths[j] - 10,
      align: "center"
    });
    dx += topWidths[j];
  });

  topY += 25;
});

  doc.end();

stream.on("finish", () => {
  return res.download(filePath, fileName, (err) => {
    if (err) console.log(err);
  });
});

  } catch (err) {
  console.log("ERROR 👉", err);

  if (!res.headersSent) {
    res.status(500).send("Report failed");
  }
  return
}

});
// ==============================
// 📊 GENERATE FULL PPT REPORT
// ==============================
router.get("/generate-ppt/:course/:batch/:semester", async (req, res) => {
  try {
    const { course, batch, semester } = req.params;

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "ChatGPT";
    pptx.subject = "Academic Analysis Report";
    pptx.title = "Academic Analysis Report";

    const analysis = generateAnalysis(excelData);

    const {
      subjects,
      subjectStats,
      failureBreakdown,
      gradeCount,
      passCount,
      failCount,
      toppers
    } = analysis;

    const totalStudents = excelData.length;
    const passPercent =
      totalStudents > 0
        ? ((passCount / totalStudents) * 100).toFixed(2)
        : 0;

    // =====================================================
    // PREPARE COMMON DATA
    // =====================================================
    let subLabels = [];
    let appearedData = [];
    let passData = [];
    let failData = [];
    let absentData = [];
    let passPercentData = [];

    subjects.forEach(sub => {
      const stat = subjectStats[sub];

      const appeared = stat.total;
      const pass = stat.pass;
      const fail = stat.fail;
      const absent = stat.absent;
      const passP = appeared
        ? ((pass / appeared) * 100).toFixed(2)
        : 0;

      subLabels.push(sub);
      appearedData.push(appeared);
      passData.push(pass);
      failData.push(fail);
      absentData.push(absent);
      passPercentData.push(Number(passP));
    });

    // =====================================================
    // CHART 1 - SUBJECT ANALYSIS
    // =====================================================
    const subjectChart = await chartJS.renderToBuffer({
      type: "bar",
      data: {
        labels: subLabels,
        datasets: [
          { label: "Appeared", data: appearedData, backgroundColor: "#4e73df" },
          { label: "Pass", data: passData, backgroundColor: "#2ecc71" },
          { label: "Fail", data: failData, backgroundColor: "#e74a3b" },
          { label: "Absent", data: absentData, backgroundColor: "#858796" },
          { label: "Pass %", data: passPercentData, backgroundColor: "#36A2EB" }
        ]
      },
       options: {
    plugins: {
      legend: { position: "top" },
      datalabels: {
        anchor: "end",
        align: "top",
        font: { weight: "bold", size: 10 },
        formatter: value => value
      }
    },
    scales: {
      y: { beginAtZero: true }
    }
  },
  plugins: [ChartDataLabels]
});
  

    // =====================================================
    // FAILURE DATA
    // =====================================================
    let intData = [];
    let extData = [];
    let totalFailData = [];

    subjects.forEach(sub => {
      intData.push(failureBreakdown[sub].intFail);
      extData.push(failureBreakdown[sub].extFail);
      totalFailData.push(failureBreakdown[sub].totalFail);
    });

    const failureChart = await chartJS.renderToBuffer({
      type: "bar",
      data: {
        labels: subjects,
        datasets: [
          { label: "INT < 6", data: intData, backgroundColor: "#f39c12" },
          { label: "EXT < 24", data: extData, backgroundColor: "#e74a3b" },
          { label: "TOTAL < 35", data: totalFailData, backgroundColor: "#8e44ad" }
        ]
      },
      options: {
  plugins: {
    datalabels: {
      anchor: "end",
      align: "top",
      font: { weight: "bold", size: 10 }
    }
  },
  scales: {
    y: { beginAtZero: true }
  }
},
plugins: [ChartDataLabels]
    });

    // =====================================================
    // INTERNAL / EXTERNAL + TOTAL DATA
    // =====================================================
    let scoreBand = {};
    let totalBand = {};

    subjects.forEach(sub => {
      scoreBand[sub] = {
        int1: 0, int2: 0, int3: 0,
        ext1: 0, ext2: 0, ext3: 0
      };

      totalBand[sub] = {
        t1: 0, t2: 0, t3: 0, t4: 0, t5: 0
      };
    });

    excelData.forEach(student => {
      subjects.forEach(sub => {
        const isa = Number(student[sub + "_ISA"]) || 0;
        const esa = Number(student[sub + "_ESA"]) || 0;
        const total = Number(student[sub + "_Tot"]) || 0;

        if (isa < 10) scoreBand[sub].int1++;
        else if (isa <= 14) scoreBand[sub].int2++;
        else scoreBand[sub].int3++;

        if (esa < 50) scoreBand[sub].ext1++;
        else if (esa <= 64) scoreBand[sub].ext2++;
        else scoreBand[sub].ext3++;

        if (total < 35) totalBand[sub].t1++;
        else if (total <= 50) totalBand[sub].t2++;
        else if (total <= 65) totalBand[sub].t3++;
        else if (total <= 80) totalBand[sub].t4++;
        else totalBand[sub].t5++;
      });
    });

    // Internal External Chart
    const bandChart = await chartJS.renderToBuffer({
      type: "bar",
      data: {
        labels: subjects,
        datasets: [
          { label: "INT <10", data: subjects.map(s => scoreBand[s].int1), backgroundColor: "#e74a3b" },
          { label: "10-14", data: subjects.map(s => scoreBand[s].int2), backgroundColor: "#f39c12" },
          { label: "15-20", data: subjects.map(s => scoreBand[s].int3), backgroundColor: "#2ecc71" },
          { label: "EXT <50", data: subjects.map(s => scoreBand[s].ext1), backgroundColor: "#9b59b6" },
          { label: "50-64", data: subjects.map(s => scoreBand[s].ext2), backgroundColor: "#3498db" },
          { label: "65-80", data: subjects.map(s => scoreBand[s].ext3), backgroundColor: "#1abc9c" }
        ]
      },
      options: {
  plugins: {
    datalabels: {
      anchor: "end",
      align: "top",
      font: { weight: "bold", size: 10 }
    }
  },
  scales: {
    y: { beginAtZero: true }
  }
},
plugins: [ChartDataLabels]
    });

    // Total Mark Chart
    const totalChart = await chartJS.renderToBuffer({
      type: "bar",
      data: {
        labels: subjects,
        datasets: [
          { label: "<35", data: subjects.map(s => totalBand[s].t1), backgroundColor: "#e74a3b" },
          { label: "35-50", data: subjects.map(s => totalBand[s].t2), backgroundColor: "#f39c12" },
          { label: "50-65", data: subjects.map(s => totalBand[s].t3), backgroundColor: "#3498db" },
          { label: "65-80", data: subjects.map(s => totalBand[s].t4), backgroundColor: "#2ecc71" },
          { label: ">80", data: subjects.map(s => totalBand[s].t5), backgroundColor: "#8e44ad" }
        ]
      },
      options: {
  plugins: {
    datalabels: {
      anchor: "end",
      align: "top",
      font: { weight: "bold", size: 10 }
    }
  },
  scales: {
    y: { beginAtZero: true }
  }
},
plugins: [ChartDataLabels]
    });

    // Grade Chart
    const gradeOrder = ["S","A+","A","B+","B","C","D","F"];
    const gradeValues = gradeOrder.map(g => gradeCount[g] || 0);

    const gradeChart = await chartJS.renderToBuffer({
      type: "bar",
      data: {
        labels: gradeOrder,
        datasets: [{
          label: "Students",
          data: gradeValues,
          backgroundColor: "#4e73df"
        }]
      },
      options: {
  plugins: {
    datalabels: {
      anchor: "end",
      align: "top",
      font: { weight: "bold", size: 12 }
    }
  },
  scales: {
    y: { beginAtZero: true }
  }
},
plugins: [ChartDataLabels]
    });

    // =====================================================
    // SLIDE 1 - TITLE
    // =====================================================
    let slide = pptx.addSlide();
    slide.addText("ACADEMIC ANALYSIS REPORT", {
      x: 1, y: 0.6, w: 11,
      fontSize: 24,
      bold: true,
      align: "center"
    });

    slide.addText(`Course: ${course}`, { x: 1, y: 2 });
    slide.addText(`Batch: ${batch}`, { x: 1, y: 2.5 });
    slide.addText(`Semester: ${semester}`, { x: 1, y: 3 });

    // =====================================================
    // SLIDE 2 - SUMMARY
    // =====================================================
    slide = pptx.addSlide();
    slide.addText("Summary", { x: 0.5, y: 0.3, fontSize: 22, bold: true });

    slide.addTable([
      ["Parameter", "Value"],
      ["Total Students", totalStudents],
      ["Passed", passCount],
      ["Failed", failCount],
      ["Pass %", passPercent]
    ], {
      x: 1, y: 1.3, w: 6
    });

    // =====================================================
    // SLIDE 3 - SUBJECT TABLE
    // =====================================================
    slide = pptx.addSlide();
    slide.addText("Subject Wise Analysis", { x: 0.5, y: 0.3, fontSize: 22, bold: true });

    slide.addTable([
      ["Subject", "Appeared", "Pass", "Fail", "Absent", "Pass %"],
      ...subjects.map(sub => {
        const s = subjectStats[sub];
        const pp = s.total ? ((s.pass / s.total) * 100).toFixed(2) : 0;
        return [sub, s.total, s.pass, s.fail, s.absent, pp];
      })
    ], { x: 0.3, y: 1, w: 12.5 });

    // =====================================================
    // SLIDE 4 - SUBJECT CHART
    // =====================================================
    slide = pptx.addSlide();
    slide.addText("Subject Wise Chart", { x: 0.5, y: 0.3, fontSize: 22, bold: true });

    slide.addImage({
      data: `data:image/png;base64,${subjectChart.toString("base64")}`,
      x: 0.4, y: 1, w: 12, h: 5.5
    });

    // =====================================================
    // SLIDE 5 - FAILURE TABLE
    // =====================================================
    slide = pptx.addSlide();
    slide.addText("Failure Analysis", { x: 0.5, y: 0.3, fontSize: 22, bold: true });

    slide.addTable([
      ["Subject", "INT <6", "EXT <24", "TOTAL <35"],
      ...subjects.map(sub => [
        sub,
        failureBreakdown[sub].intFail,
        failureBreakdown[sub].extFail,
        failureBreakdown[sub].totalFail
      ])
    ], { x: 1, y: 1.3, w: 8 });

    // =====================================================
    // SLIDE 6 - FAILURE CHART
    // =====================================================
    slide = pptx.addSlide();
    slide.addText("Failure Chart", { x: 0.5, y: 0.3, fontSize: 22, bold: true });

    slide.addImage({
      data: `data:image/png;base64,${failureChart.toString("base64")}`,
      x: 0.4, y: 1, w: 12, h: 5.5
    });

    // =====================================================
    // SLIDE 7 - INTERNAL EXTERNAL TABLE
    // =====================================================
    slide = pptx.addSlide();
    slide.addText("Internal vs External Analysis", { x: 0.3, y: 0.3, fontSize: 20, bold: true });

    slide.addTable([
      ["Subject","<10","10-14","15-20","<50","50-64","65-80"],
      ...subjects.map(sub => {
        const d = scoreBand[sub];
        return [sub,d.int1,d.int2,d.int3,d.ext1,d.ext2,d.ext3];
      })
    ], { x: 0.2, y: 1, w: 12.8 });

    // =====================================================
    // SLIDE 8 - INTERNAL EXTERNAL CHART
    // =====================================================
    slide = pptx.addSlide();
    slide.addText("Internal vs External Chart", { x: 0.5, y: 0.3, fontSize: 22, bold: true });

    slide.addImage({
      data: `data:image/png;base64,${bandChart.toString("base64")}`,
      x: 0.3, y: 1, w: 12.2, h: 5.5
    });

    // =====================================================
    // SLIDE 9 - TOTAL TABLE
    // =====================================================
    slide = pptx.addSlide();
    slide.addText("Total Mark Analysis", { x: 0.5, y: 0.3, fontSize: 22, bold: true });

    slide.addTable([
      ["Subject","<35","35-50","50-65","65-80",">80"],
      ...subjects.map(sub => {
        const d = totalBand[sub];
        return [sub,d.t1,d.t2,d.t3,d.t4,d.t5];
      })
    ], { x: 0.5, y: 1.3, w: 11 });

    // =====================================================
    // SLIDE 10 - TOTAL CHART
    // =====================================================
    slide = pptx.addSlide();
    slide.addText("Total Mark Chart", { x: 0.5, y: 0.3, fontSize: 22, bold: true });

    slide.addImage({
      data: `data:image/png;base64,${totalChart.toString("base64")}`,
      x: 0.3, y: 1, w: 12.2, h: 5.5
    });

    // =====================================================
    // SLIDE 11 - GRADE TABLE
    // =====================================================
    slide = pptx.addSlide();
    slide.addText("Grade vs Number of Students", { x: 0.5, y: 0.3, fontSize: 20, bold: true });

    slide.addTable([
      gradeOrder,
      gradeValues
    ], { x: 1.2, y: 1.5, w: 10 });

    // =====================================================
    // SLIDE 12 - GRADE CHART
    // =====================================================
    slide = pptx.addSlide();
    slide.addText("Grade Chart", { x: 0.5, y: 0.3, fontSize: 22, bold: true });

    slide.addImage({
      data: `data:image/png;base64,${gradeChart.toString("base64")}`,
      x: 1, y: 1.2, w: 10.5, h: 5
    });

    // =====================================================
    // SLIDE 13 - TOP 10 STUDENTS
    // =====================================================
    slide = pptx.addSlide();
    slide.addText("Top 10 Students", { x: 0.5, y: 0.3, fontSize: 22, bold: true });

    let rank = 0;
    let prev = null;

    const topperRows = [
      ["Rank", "Name", "SGPA", "Total", "Grade"]
    ];

    toppers.slice(0, 10).forEach(t => {
      if (t.sgpa !== prev) {
        rank++;
        prev = t.sgpa;
      }

      topperRows.push([
        rank,
        t.name,
        t.sgpa,
        t.total,
        t.grade
      ]);
    });

    slide.addTable(topperRows, {
      x: 0.5, y: 1.2, w: 12
    });

    // =====================================================
    // SAVE FILE
    // =====================================================
    const fileName = `report_${Date.now()}.pptx`;
    const filePath = path.join(__dirname, "../reports", fileName);

    await pptx.writeFile({ fileName: filePath });

    return res.download(filePath);

  } catch (err) {
    console.error("PPT ERROR:", err);
    return res.status(500).json({ error: "PPT generation failed" });
  }
});
module.exports = router;