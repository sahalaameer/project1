let currentRecord = null;
let currentType = null;
// Open notification panel
async function openNotifications(){

  const bar = document.getElementById("notificationBar");

  if(bar.style.display === "none"){
    bar.style.display = "block";

    // ✅ FIRST mark all as read
    await fetch("http://localhost:3000/api/notifications/read-all",{
      method:"PUT",
      headers:{
        Authorization:"Bearer "+localStorage.getItem("token")
      }
    });

    // ✅ THEN load updated notifications
    await loadNotifications();

    // ✅ hide red dot
    document.getElementById("notifDot").style.display = "none";

  }else{
    bar.style.display = "none";
  }
}

// Load notifications
async function loadNotifications(){

const res = await fetch("http://localhost:3000/api/notifications",{
headers:{
Authorization:"Bearer "+localStorage.getItem("token")
}
});

const data = await res.json();

const list = document.getElementById("notifications");
list.innerHTML = "";

let unreadExists = false;

data.forEach(n=>{

const li = document.createElement("li");
li.innerText = "📢 " + n.message;

li.onclick = async () => {

  await markAsRead(n._id);
  li.style.opacity = "0.6";

  // ✅ REAL LOGIC USING marksId
  if (n.type === "MARKS_UPLOADED" && n.marksId) {

    const res = await fetch(
      `http://localhost:3000/api/marks/id/${n.marksId}`
    );

    const exam = await res.json();

    showMarks(exam); // NEW clean function
  }

};

list.appendChild(li);

if(!n.isRead){
unreadExists = true;
}

});

if(unreadExists){
  document.getElementById("notifDot").style.display="block";
}
else{
  document.getElementById("notifDot").style.display="none";
}

}
async function checkPopupNotification() {

  const res = await fetch("http://localhost:3000/api/notifications", {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const data = await res.json();

  const unread = data.filter(n => !n.isRead);

  let marksShown = false;
  let attendanceShown = false;

  for (let n of unread) {

    if (n.type === "MARKS_UPLOADED" && !marksShown) {
      alert("📘 Your marks have been uploaded.");
      marksShown = true;
    }

    if (n.type === "ATTENDANCE_UPLOADED" && !attendanceShown) {
      alert("📅 Your attendance has been updated.");
      attendanceShown = true;
    }

  }
}
// Mark notification as read
async function markAsRead(id){

await fetch(`http://localhost:3000/api/notifications/read/${id}`,{
method:"PUT",
headers:{
Authorization:"Bearer "+localStorage.getItem("token")
}
});
loadNotifications();

}

// Run when page loads
window.onload = async function () {
  await loadNotifications();
  await checkPopupNotification();
};
async function loadMarks(type){

const rollNo = localStorage.getItem("rollNo");

const res = await fetch(`http://localhost:3000/api/marks/${type}/${rollNo}`,{
headers:{
Authorization:"Bearer "+localStorage.getItem("token")
}
});

const data = await res.json();

if(data.length===0){
  alert("No marks found");
  return;
}

document.getElementById("title").innerText =
"Roll No: " + data[0].rollNo +
" | Sem: " + data[0].semester +
" | " + type.toUpperCase();

const table = document.getElementById("marksTable");
const tbody = table.querySelector("tbody");

table.querySelector("thead").innerHTML = `
  <tr>
    <th>Subject</th>
    <th>Marks</th>
    <th>Status</th>
  </tr>
`;

tbody.innerHTML="";



const subjects = data[0].subjects;

for (let subject in subjects) {

  const marks = subjects[subject];
  let status = "";

  // 🎯 Pass/Fail rules
  if(type === "internal"){
    status = marks >= 20 ? "Pass" : "Fail";
  }
  else if(type === "model"){
    status = marks >= 35 ? "Pass" : "Fail";
  }
  else if(type === "final"){
    status = marks >= 15 ? "Pass" : "Fail";
  }

  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${subject}</td>
    <td>${marks}</td>
    <td style="color:${status==="Pass"?"green":"red"};font-weight:bold;">
      ${status}
    </td>
  `;

  tbody.appendChild(row);
}


table.style.display = "table";

currentRecord = data[0];
currentType = type;

// 🔥 BUTTON CONTROL (correct place)
const btn = document.getElementById("predictBtn");

if(type === "internal"){
  btn.style.display = "inline-block";
}else{
  btn.style.display = "none";
}
}

function showMarks(exam){

document.getElementById("title").innerText =
"Roll No: " + exam.rollNo +
" | Sem: " + exam.semester +
" | " + exam.type.toUpperCase();

const table = document.getElementById("marksTable");
const tbody = table.querySelector("tbody");

tbody.innerHTML = "";

const subjects = exam.subjects;

for (let subject in subjects) {

  const marks = subjects[subject];
  let status = "";

  if(exam.type === "internal"){
    status = marks >= 20 ? "Pass" : "Fail";
  }
  else if(exam.type === "model"){
    status = marks >= 35 ? "Pass" : "Fail";
  }
  else if(exam.type === "final"){
    status = marks >= 15 ? "Pass" : "Fail";
  }

  const row = document.createElement("tr");

  row.innerHTML = `
    <td>${subject}</td>
    <td>${marks}</td>
    <td style="color:${status==="Pass"?"green":"red"};font-weight:bold;">
      ${status}
    </td>
  `;

  tbody.appendChild(row);
}

table.style.display = "table";
}
async function showPrediction(type, currentRecord){

const box = document.getElementById("predictionBox");
const btn = document.getElementById("predictBtn");

box.innerHTML = "";

// only internal allowed
if(type !== "internal"){
  btn.style.display = "none";
  return;
}

btn.style.display = "inline-block";

const rollNo = localStorage.getItem("rollNo");

const res = await fetch(`http://localhost:3000/api/marks/model/${rollNo}`,{
headers:{
Authorization:"Bearer "+localStorage.getItem("token")
}
});

const modelData = await res.json();

let matchedModel = null;

if(Array.isArray(modelData)){
  matchedModel = modelData.find(item =>
    item.course === currentRecord.course &&
    item.batch === currentRecord.batch &&
    item.semester === currentRecord.semester
  );
}

// ✅ START TABLE
let tableHTML = `
<table class="prediction-table">
  <thead>
    <tr>
      <th>Subject</th>
      <th>Type</th>
      <th>Score</th>
    </tr>
  </thead>
  <tbody>
`;

for(let subject in currentRecord.subjects){

const internal = currentRecord.subjects[subject];

// =====================
// CASE 1: ONLY INTERNAL
// =====================
if(!matchedModel || matchedModel.subjects[subject] === undefined){

let need =
((20 - 5 - (internal/40*10)) / 10) * 75;

if(need < 0) need = 0;
if(need > 75) need = 75;

tableHTML += `
<tr>
  <td>${subject}</td>
  <td>🎯 Model Target</td>
  <td style="color:#ff9800;font-weight:bold;">
    ${need.toFixed(1)} / 75
  </td>
</tr>
`;

}

// =====================
// CASE 2: INTERNAL + MODEL
// =====================
else{

const model = matchedModel.subjects[subject];

const finalMark =
(internal / 40 * 10) +
(model / 75 * 10) + 5;

tableHTML += `
<tr>
  <td>${subject}</td>
  <td>🟢 Final Internal</td>
  <td style="color:green;font-weight:bold;">
    ${finalMark.toFixed(1)} / 25
  </td>
</tr>
`;
}

}

// ✅ CLOSE TABLE
tableHTML += `
  </tbody>
</table>
`;

box.innerHTML = tableHTML;
box.style.display = "block";
}
async function togglePrediction(){
  const box = document.getElementById("predictionBox");

  if(!currentRecord){
    alert("Load Internal marks first");
    return;
  }

  if(box.style.display === "block"){
    box.style.display = "none";
    return;
  }

  if(currentType !== "internal"){
    alert("Prediction only available for Internal marks");
    return;
  }

  await showPrediction(currentType, currentRecord);
  box.style.display = "block";
}
async function loadAttendance() {
  document.getElementById("title").innerText = "Monthly Attendance";

  const table = document.getElementById("marksTable");
  const tbody = table.querySelector("tbody");

  table.style.display = "table";
  document.getElementById("chartBtn").style.display = "none";
  document.getElementById("marksChart").style.display = "none";
  document.getElementById("predictBtn").style.display = "none";

  tbody.innerHTML = "";

  const res = await fetch("http://localhost:3000/api/attendance/student", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`
    }
  });

  const data = await res.json();

  // Change headings
  table.querySelector("thead").innerHTML = `
    <tr>
      <th>Month</th>
      <th>Working Days</th>
      <th>Present Days</th>
      <th>Attendance %</th>
    </tr>
  `;

  data.forEach(row => {
    tbody.innerHTML += `
      <tr>
        <td>${row.month}</td>
        <td>${row.workingDays}</td>
        <td>${row.presentDays}</td>
        <td>${row.percentage}%</td>
      </tr>
    `;
  });
}
function logout(){
  localStorage.clear();   // remove token + rollNo
  window.location.href = "index.html";  // redirect to login page
}