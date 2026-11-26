import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const API_URL = "https://fundsiq-api.onrender.com";
const ADMIN_EMAIL = "fundsiqofficial@gmail.com";

const statusBox = document.getElementById("status");
const dashboard = document.getElementById("dashboard");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");

let currentUser = null;

function money(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function dateText(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.style.border = isError ? "1px solid #9f4242" : "1px solid #263650";
  statusBox.style.color = isError ? "#fecaca" : "#cbd5e1";
}

function renderBars(items) {
  const root = document.getElementById("registrationChart");
  root.replaceChildren();
  const max = Math.max(1, ...items.map(item => Number(item.registrations || 0)));
  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "bar-row";
    const label = document.createElement("span");
    label.textContent = item.date.slice(5);
    const track = document.createElement("div");
    track.className = "track";
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.width = (Number(item.registrations || 0) / max * 100) + "%";
    track.appendChild(bar);
    const count = document.createElement("strong");
    count.textContent = item.registrations;
    row.append(label, track, count);
    root.appendChild(row);
  });
}

function renderReferrals(data) {
  const labels = [
    ["Organic", data.organic],
    ["Personal referrals", data.personalReferrals],
    ["Marketer referrals", data.marketerReferrals],
    ["Unmatched referral codes", data.otherReferred]
  ];
  const root = document.getElementById("referralStats");
  root.replaceChildren();
  const total = labels.reduce((sum, item) => sum + Number(item[1] || 0), 0);
  labels.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    const name = document.createElement("span");
    name.textContent = label;
    const track = document.createElement("div");
    track.className = "track";
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.width = (total ? Number(value || 0) / total * 100 : 0) + "%";
    track.appendChild(bar);
    const count = document.createElement("strong");
    count.textContent = value || 0;
    row.append(name, track, count);
    root.appendChild(row);
  });
}

function renderMarketers(data) {
  const body = document.getElementById("marketerRows");
  body.replaceChildren();
  const items = data.list || [];
  if (!items.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No marketer accounts found yet.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }
  items.forEach(item => {
    const row = document.createElement("tr");
    const values = [
      item.name + (item.email ? " · " + item.email : ""),
      item.referralCode || "—",
      item.totalReferrals || 0,
      item.premiumSales || 0,
      (item.conversionRate || 0) + "%",
      money(item.commissionEarned || 0)
    ];
    values.forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
}

function renderPurchases(items) {
  const body = document.getElementById("purchaseRows");
  body.replaceChildren();
  if (!items.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No successful Premium purchases have been recorded yet.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }
  items.forEach(item => {
    const row = document.createElement("tr");
    [item.customerName + (item.customerEmail ? " · " + item.customerEmail : ""),
      money(item.amount), dateText(item.date), item.reference, item.referralCode || "Organic / none"]
      .forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
    body.appendChild(row);
  });
}

async function loadAnalytics() {
  if (!currentUser) return;
  setStatus("Loading FundsIQ analytics…");
  refreshBtn.disabled = true;
  try {
    const token = await currentUser.getIdToken(true);
    const response = await fetch(API_URL + "/api/admin/analytics", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.msg || "Unable to load analytics.");
    }

    document.getElementById("totalUsers").textContent = data.registrations.total;
    document.getElementById("todayUsers").textContent = data.registrations.today;
    document.getElementById("weekUsers").textContent = data.registrations.thisWeek;
    document.getElementById("monthUsers").textContent = data.registrations.thisMonth;
    document.getElementById("activePremium").textContent = data.premium.activeAccounts;
    document.getElementById("purchasers").textContent = data.premium.uniquePurchasersRecorded;
    document.getElementById("purchaseCount").textContent = data.premium.successfulPurchasesRecorded;
    document.getElementById("revenue").textContent = money(data.premium.revenueNaira);
    document.getElementById("cbtUsers").textContent = data.cbt.participantsTracked;
    document.getElementById("cbtAttempts").textContent = data.cbt.attemptsTracked;
    document.getElementById("cbtNote").textContent = data.cbt.note;
    document.getElementById("activityNote").textContent = data.activity.note;

    renderBars(data.registrations.byDay || []);
    renderReferrals(data.referrals || {});
    renderMarketers(data.marketers || {});
    renderPurchases(data.premium.recentPurchases || []);

    document.getElementById("updatedAt").textContent =
      "Last updated: " + dateText(data.generatedAt);
    dashboard.classList.remove("hidden");
    setStatus("Administrator access verified · " + currentUser.email);
  } catch (error) {
    dashboard.classList.add("hidden");
    setStatus(error.message || "Could not load analytics.", true);
  } finally {
    refreshBtn.disabled = false;
  }
}

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (!user) {
    dashboard.classList.add("hidden");
    setStatus("Please log in with the FundsIQ administrator account.");
    return;
  }
  if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) {
    dashboard.classList.add("hidden");
    setStatus("This account is not the designated administrator account. Please switch to " + ADMIN_EMAIL + ".", true);
    return;
  }
  loadAnalytics();
});

refreshBtn.addEventListener("click", loadAnalytics);
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    setStatus("Could not log out: " + error.message, true);
  }
});
