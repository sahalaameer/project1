const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const QuickChart = require("quickchart-js");
const fs = require("fs");
const path = require("path");
const Marks = require("../models/Marks");

const PptxGenJS = require("pptxgenjs");
router.post("/generate-report", async (req, res) => {

try {

const { course, batch, semester, type } = req.body;

const students = await Marks.find({
course,
batch,
semester,
type
});

const totalStudents = students.length;

let passCount = 0;
let failCount = 0;

let subjectTotals = {};
let subjectFails = {};

let failedStudents = [];

let studentTotals = [];

let passMark;

if(type === "internal") passMark = 20;
else if(type === "model") passMark = 35;
else if(type === "final") passMark = 15;

students.forEach(student => {

let overallPass = true;
let failedSubjects = [];

let total = 0;

for(let subject in student.subjects){

const mark = student.subjects[subject];

total += mark;

if(!subjectTotals[subject]){
subjectTotals[subject] = 0;
subjectFails[subject] = 0;
}

subjectTotals[subject] += mark;

if(mark < passMark){
overallPass = false;
failedSubjects.push(subject);
subjectFails[subject]++;
}

}

studentTotals.push({
name: student.name,
rollNo: student.rollNo,
total
});

if(overallPass) passCount++;
else {
failCount++;
failedStudents.push({
name: student.name,
subjects: failedSubjects.join(", ")
});
}

});

const passPercent = ((passCount / totalStudents) * 100).toFixed(2);
const failPercent = ((failCount / totalStudents) * 100).toFixed(2);

const subjectNames = Object.keys(subjectTotals);

const subjectAverages = subjectNames.map(sub =>
(subjectTotals[sub] / totalStudents).toFixed(2)
);

studentTotals.sort((a,b)=> b.total - a.total);

const toppers = studentTotals.slice(0,5);

const pieChart = new QuickChart();

pieChart.setConfig({
type:'pie',
data:{
labels:['Pass','Fail'],
datasets:[{
data:[passCount,failCount],
backgroundColor:['#2ecc71','#e74c3c']
}]
}
});

await pieChart.toFile('./charts/passfail.png');

const subjectChart = new QuickChart();

subjectChart.setConfig({
type:'bar',
data:{
labels:subjectNames,
datasets:[{
label:'Average Marks',
data:subjectAverages,
backgroundColor:'#3498db'
}]
}
});

await subjectChart.toFile('./charts/subjects.png');

const failChart = new QuickChart();

failChart.setConfig({
type:'bar',
data:{
labels:subjectNames,
datasets:[{
label:'Failed Students',
data:subjectNames.map(s=>subjectFails[s]),
backgroundColor:'#e67e22'
}]
}
});

await failChart.toFile('./charts/fails.png');

const doc = new PDFDocument();

const filePath = `./reports/result_${Date.now()}.pdf`;

doc.pipe(fs.createWriteStream(filePath));

doc.fontSize(22).text("RESULT ANALYSIS REPORT",{align:"center"});
doc.moveDown();

doc.fontSize(12).text(`Generated On: ${new Date().toLocaleDateString()}`);
doc.moveDown();

doc.fontSize(12).text(`Course: ${course}`);
doc.text(`Batch: ${batch}`);
doc.text(`Semester: ${semester}`);
doc.text(`Exam Type: ${type}`);


doc.text(`Total Students: ${totalStudents}`);
doc.text(`Passed: ${passCount}`);
doc.text(`Failed: ${failCount}`);
doc.text(`Pass %: ${passPercent}`);
doc.text(`Fail %: ${failPercent}`);
doc.moveDown();
doc.moveTo(40, doc.y)
   .lineTo(doc.page.width - 40, doc.y)
   .stroke();
doc.moveDown();

doc.moveDown();

doc.text("Top Performers");

toppers.forEach((t,i)=>{
doc.text(`${i+1}. ${t.name} (${t.rollNo}) - ${t.total}`);
});

doc.moveDown();

doc.text("Failed Students");

failedStudents.forEach(s=>{
doc.text(`${s.name} - ${s.subjects}`);
});

doc.addPage();

doc.text("Pass vs Fail Chart");
doc.image('./charts/passfail.png',{width:400});

doc.moveDown();

doc.text("Subject Average Chart");
doc.image('./charts/subjects.png',{width:400});

doc.moveDown();

doc.text("Subject Failure Chart");
doc.image('./charts/fails.png',{width:400});

doc.end();

res.json({
message:"Report Generated",
file:filePath
});

} catch(error){

console.log(error);
res.status(500).json({error:"Report generation failed"});

}

});


router.get("/generate-ppt/:course/:batch/:semester", async (req, res) => {
  try {
    const { course, batch, semester } = req.params;

    const pptx = new PptxGenJS();

    let slide1 = pptx.addSlide();
    slide1.addText("RESULT ANALYSIS REPORT", { x: 1, y: 1, fontSize: 24 });

    slide1.addText(`Course: ${course}`, { x: 1, y: 2 });
    slide1.addText(`Batch: ${batch}`, { x: 1, y: 2.5 });
    slide1.addText(`Semester: ${semester}`, { x: 1, y: 3 });

    const fileName = `report_${Date.now()}.pptx`;
    const filePath = path.join(__dirname, "../reports", fileName);

    await pptx.writeFile({ fileName: filePath });

    return res.download(filePath);

  } catch (err) {
    console.error("PPT ERROR:", err);
    res.status(500).json({ error: "PPT generation failed" });
  }
});
module.exports = router;