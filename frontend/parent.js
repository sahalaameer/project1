let popupShown = false;
function hideAllTables() {
  const table = document.getElementById("marksTable");
  if (table) table.style.display = "none";
}
// 🔔 Open notification panel
async function openNotifications() {
  const bar = document.getElementById("notificationBar");

  if(bar.style.display === "none"){
    bar.style.display = "block";

    // ✅ Mark all parent notifications as read
  await fetch("http://localhost:3000/api/notifications/read-all", {
  method: "PUT",
  headers: {
    Authorization: "Bearer " + localStorage.getItem("token")
  }
});

    await loadNotifications();

   
  } else {
    bar.style.display = "none";
  }
}


// 🔔 Load notifications
async function loadNotifications(){

const res = await fetch("http://localhost:3000/api/notifications",{
headers:{
Authorization:"Bearer "+localStorage.getItem("token")
}
});

const data = await res.json();

console.log("Notifications Data:", data); // ✅ OK

const list = document.getElementById("notifications");
list.innerHTML = "";

let unreadExists = false;

data.forEach(n => {


const li = document.createElement("li");
li.innerText = "📢 " + n.message;

li.onclick = async () => {

  await markAsRead(n._id);
  li.style.opacity = "0.6";

  // ✅ NEW LOGIC: open real marks using marksId
  if (n.type === "MARKS_UPLOADED" && n.marksId) {

    const res = await fetch(
      `http://localhost:3000/api/marks/${n.marksId}`
    );

    const marks = await res.json();

    showMarks(marks); // 👈 NEW function
  }

};

list.appendChild(li);

if(!n.isRead){
  unreadExists = true;
}

});

document.getElementById("notifDot").style.display =
  unreadExists ? "block" : "none";

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


// ✅ Mark single notification as read
async function markAsRead(id){

await fetch(`http://localhost:3000/api/notifications/read/${id}`,{
method:"PUT",
headers:{
Authorization:"Bearer "+localStorage.getItem("token")
}
});

loadNotifications();
}


// 🚀 Load on page start
window.onload = async function () {
  await loadNotifications();
  await checkPopupNotification();
};


// 📊 Load Marks (Parent API)
async function loadMarks(type){
hideAllTables();
const res = await fetch("http://localhost:3000/api/parent/marks",{
headers:{
Authorization:"Bearer "+localStorage.getItem("token")
}
});

const data = await res.json();

const exam = data.find(m => m.type === type);

if(!exam){
alert("No marks found");
return;
}


// ✅ Title with semester
document.getElementById("title").innerText =
"Roll No: " + exam.rollNo +
" | Sem: " + exam.semester +
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
tbody.innerHTML = "";

const subjects = exam.subjects;

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
async function loadAttendance() {
   hideAllTables();
  const res = await fetch("http://localhost:3000/api/attendance/parent", {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const data = await res.json();

  const table = document.getElementById("marksTable");
  const tbody = table.querySelector("tbody");
  
  const thead = table.querySelector("thead"); 
  document.getElementById("title").innerText = "Attendance Details";

  tbody.innerHTML = "";
thead.innerHTML = `
    <tr>
      <th>Month</th>
      <th>Working Days</th>
      <th>Present Days</th>
      <th>Attendance %</th>
    </tr>
  `;
  data.forEach(a => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${a.month}</td>
      <td>${a.workingDays}</td>
      <td>${a.presentDays}</td>
      <td>${a.percentage}%</td>
    `;

    tbody.appendChild(row);
  });

  table.style.display = "table";
}
// 🚪 Logout
function logout(){
localStorage.clear();
window.location.href = "index.html";
}