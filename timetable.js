/**
 * FundsIQ Timetable & Productivity Core Engine
 * Integrates directly with Cloud Firestore (Modular SDK v12)
 * Developed by Odigwe Joshua
 */

// Import Firebase services from your existing firebase.js
import { auth, db } from "./firebase.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    getDocs,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// Signal the HTML watchdog that this ES module loaded and parsed successfully.
window.__fundsiqTimetableModuleStarted = true;

// =========================================================================
// 2. TIMETABLE RUNTIME SYSTEM STATE
// =========================================================================
const State = {
    user: null,
    activeTab: "personal", // 'personal' | 'lecture' | 'exam'
    activeView: "timeline", // 'timeline' | 'weekly'
    filterDay: "ALL",
    searchQuery: "",
    classes: [],           // Real-time synchronization store
    lectureTimetable: [],  // Official pre-loaded DELSU schedule
    examTimetable: [],     // Official pre-loaded DELSU exam schedule
    selectedEditId: null,
    selectedDeleteId: null,
    activeProductivityId: null,
    clockInterval: null
};

// =========================================================================
// 3. OFFICIAL DELSU LECTURE & EXAM DATABASES (FAST OFFLINE PRE-LOAD)
// =========================================================================
// No official lecture timetable is preloaded. Students create their own schedule.
State.lectureTimetable = [];

// No exam dates are preloaded. Students manage their own exam schedule.
State.examTimetable = [];

// =========================================================================
// 4. UX ALERTS (TOAST NOTIFIER ENGINE)
// =========================================================================
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-indicator"></span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Fade and destroy
    setTimeout(() => {
        toast.style.animation = "toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// =========================================================================
// 5. SECURE STATE RETRIEVALS
// =========================================================================
function getActiveCollection() {
    if (State.activeTab === "personal") {
        return State.classes;
    } else if (State.activeTab === "lecture") {
        return State.lectureTimetable;
    } else {
        return State.examTimetable;
    }
}

// =========================================================================
// 6. FIRESTORE INTERACTION MODULE
// =========================================================================
let unsubscribeSnapshot = null;

function subscribeToFirestoreTimetable(user) {
    if (unsubscribeSnapshot) unsubscribeSnapshot();

    const collectionPath = `users/${user.uid}/timetable`;
    const q = query(collection(db, collectionPath), orderBy("startTime", "asc"));

    toggleSkeleton(true);

    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const localItems = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            localItems.push({
                id: docSnap.id,
                ...data
            });
        });

        // Keep each timetable category separate; legacy records remain Personal.
        State.classes = localItems.filter(item => !item.type || item.type === 'personal');
        State.lectureTimetable = localItems.filter(item => item.type === 'lecture');
        State.examTimetable = localItems.filter(item => item.type === 'exam');
        saveLocalTimetable();
        toggleSkeleton(false);
        renderSchedule();
        evaluateSmartSchedule();
    }, (error) => {
        console.error("Firestore subscription error:", error);
        toggleSkeleton(false);
        showToast("Error loading cloud schedule. Offline fallback active.", "error");
        
        // Offline recovery state check
        if (State.classes.length === 0) {
            loadOfflineMockData();
        }
    });
}

// Fallback logic for sandbox/offline deployments
function loadOfflineMockData() { loadLocalTimetable(); renderSchedule(); evaluateSmartSchedule(); }

function getListForTab(type = State.activeTab) {
    if (type === 'lecture') return State.lectureTimetable;
    if (type === 'exam') return State.examTimetable;
    return State.classes;
}

function saveLocalTimetable() {
    localStorage.setItem('fundsiq_timetable_v2:' + (State.user?.uid || 'guest'), JSON.stringify({personal: State.classes, lecture: State.lectureTimetable, exam: State.examTimetable}));
}

function loadLocalTimetable() {
    try {
        const saved = JSON.parse(localStorage.getItem('fundsiq_timetable_v2:' + (State.user?.uid || 'guest')) || '{}');
        State.classes = saved.personal || []; State.lectureTimetable = saved.lecture || []; State.examTimetable = saved.exam || [];
        if (!State.user && !State.classes.length) {
            const old = JSON.parse(localStorage.getItem('offline_timetable_mock') || '[]');
            State.classes = old.filter(item => item && item.id !== 'm1'); saveLocalTimetable();
        }
    } catch (error) { console.warn('Local timetable could not be loaded', error); }
}

async function saveClassSession(data) {
    const list = getListForTab();
    const id = State.selectedEditId || (crypto.randomUUID ? crypto.randomUUID() : 'fiq_' + Date.now());
    const record = {...data, type: State.activeTab, id, updatedAt: new Date().toISOString()};
    const index = list.findIndex(item => item.id === id);
    if (index >= 0) list[index] = {...list[index], ...record}; else list.push({...record, createdAt: new Date().toISOString()});
    saveLocalTimetable();
    if (auth.currentUser) {
        try { await setDoc(doc(db, 'users/' + auth.currentUser.uid + '/timetable', id), record, { merge: true }); }
        catch (error) {
            const key = 'fundsiq_timetable_queue:' + auth.currentUser.uid;
            const queue = JSON.parse(localStorage.getItem(key) || '[]'); queue.push({action:'set', id, data:record}); localStorage.setItem(key, JSON.stringify(queue));
            showToast('Saved on this device. Cloud sync is pending.', 'error');
        }
    } else showToast(index >= 0 ? 'Schedule updated on this device.' : 'Schedule saved on this device.');
    State.selectedEditId = null; renderSchedule(); evaluateSmartSchedule();
}

async function deleteClassSession(id) {
    const list = [...State.classes, ...State.lectureTimetable, ...State.examTimetable];
    const item = list.find(entry => entry.id === id);
    const target = item ? getListForTab(item.type || 'personal') : getListForTab();
    const index = target.findIndex(entry => entry.id === id); if (index >= 0) target.splice(index, 1);
    saveLocalTimetable();
    if (auth.currentUser) {
        try { await deleteDoc(doc(db, 'users/' + auth.currentUser.uid + '/timetable', id)); }
        catch (error) {
            const key = 'fundsiq_timetable_queue:' + auth.currentUser.uid;
            const queue = JSON.parse(localStorage.getItem(key) || '[]'); queue.push({action:'delete', id}); localStorage.setItem(key, JSON.stringify(queue));
            showToast('Deleted here. Cloud deletion is pending.', 'error');
        }
    }
    State.selectedDeleteId = null; renderSchedule(); evaluateSmartSchedule();
}

async function syncPendingTimetableChanges() {
    const user = auth.currentUser;
    if (!user || !navigator.onLine) return;
    const key = 'fundsiq_timetable_queue:' + user.uid;
    const pending = JSON.parse(localStorage.getItem(key) || '[]');
    const failed = [];
    for (const op of pending) {
        try {
            const ref = doc(db, 'users/' + user.uid + '/timetable', op.id);
            if (op.action === 'delete') await deleteDoc(ref); else await setDoc(ref, op.data, { merge: true });
        } catch (error) { failed.push(op); }
    }
    localStorage.setItem(key, JSON.stringify(failed));
    if (pending.length && !failed.length) showToast('Offline timetable changes synced.');
}

// =========================================================================
// 7. COMPACT RENDERING LOGIC (DAILY, TIMELINE, WEEKLY, EXAM)
// =========================================================================
function renderSchedule() {
    const viewport = document.getElementById("active-schedule-content");
    const emptyState = document.getElementById("empty-state");
    if (!viewport || !emptyState) return;

    let dataset = getActiveCollection();

    // 1. Search Query Filters
    if (State.searchQuery.trim() !== "") {
        const q = State.searchQuery.toLowerCase();
        dataset = dataset.filter(item => 
            item.courseCode.toLowerCase().includes(q) ||
            item.courseTitle.toLowerCase().includes(q) ||
            (item.lecturer && item.lecturer.toLowerCase().includes(q)) ||
            (item.venue && item.venue.toLowerCase().includes(q))
        );
    }

    // 2. Day Dropdown Filters
    if (State.filterDay !== "ALL" && State.activeTab !== "exam") {
        dataset = dataset.filter(item => item.day === State.filterDay);
    }

    // 3. Sorting by execution start time
    if (State.activeTab !== "exam") {
        dataset.sort((a, b) => a.startTime.localeCompare(b.startTime));
    } else {
        dataset.sort((a, b) => a.date.localeCompare(b.date));
    }

    // Check dataset lengths
    if (dataset.length === 0) {
        viewport.innerHTML = "";
        emptyState.style.display = "block";
        updateDashboardMetrics(0, 0);
        return;
    }

    emptyState.style.display = "none";
    viewport.innerHTML = "";

    if (State.activeTab === "exam") {
        renderExamTimeline(viewport, dataset);
        return;
    }

    if (State.activeView === "timeline") {
        renderTimelineView(viewport, dataset);
    } else {
        renderWeeklyView(viewport, dataset);
    }

    updateDashboardMetrics(dataset.length, calculateTodayClassesCount(dataset));
}

function renderTimelineView(container, dataset) {
    const fragment = document.createDocumentFragment();

    dataset.forEach(item => {
        const card = createClassCard(item);
        fragment.appendChild(card);
    });

    container.appendChild(fragment);
}

function renderWeeklyView(container, dataset) {
    const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const fragment = document.createDocumentFragment();

    daysOrder.forEach(dayName => {
        const dayClasses = dataset.filter(item => item.day === dayName);
        if (dayClasses.length === 0) return;

        const group = document.createElement("div");
        group.className = "weekly-schedule-group";
        group.innerHTML = `<h5 class="weekly-day-header">${dayName}</h5>`;

        dayClasses.forEach(item => {
            const card = createClassCard(item);
            group.appendChild(card);
        });

        fragment.appendChild(group);
    });

    container.appendChild(fragment);
}

function createClassCard(item) {
    const card = document.createElement("div");
    card.className = "class-card fade-in";
    
    // Add glowing border class if the class is currently active (today + active hour)
    if (isClassCurrentlyActive(item)) {
        card.classList.add("active-class");
    }

    const courseLeftColor = getDeterministicColor(item.courseCode);
    const isAttended = item.attended === true;

    card.innerHTML = `
        <div class="course-glow-bar" style="background-color: ${courseLeftColor};"></div>
        <div class="class-card-body">
            <div class="card-top-row">
                <span class="course-badge" style="background-color: ${courseLeftColor}15; color: ${courseLeftColor};">${item.courseCode}</span>
                <span class="time-badge">${item.startTime} - ${item.endTime} ${State.activeTab !== 'lecture' ? '('+item.day+')' : ''}</span>
            </div>
            <h4 class="class-title">${item.courseTitle}</h4>
            <div class="details-row">
                <div class="meta-item"><span class="meta-label">Lecturer:</span> ${item.lecturer}</div>
                <div class="meta-item"><span class="meta-label">Venue:</span> ${item.venue}</div>
            </div>
            ${item.description ? `<p class="class-desc">${item.description}</p>` : ""}
            <div class="card-actions-row">
                ${State.activeTab === 'personal' ? `<button class="mini-pill-btn ${isAttended ? 'attended-pill' : ''}" onclick="window.triggerProductivity('${item.id}')">${isAttended ? '✓ Attended' : '📝 Notes & Tasks'}</button>` : ''}
                ${State.activeTab !== 'exam' ? `<div class="edit-actions">
                    <button class="icon-action-btn" onclick="window.editClassModal('${item.id}')" title="Edit Schedule">✎</button>
                    <button class="icon-action-btn delete-icon" onclick="window.triggerDeleteModal('${item.id}')" title="Delete Schedule">×</button>
                </div>` : ''}
            </div>
        </div>
    `;
    return card;
}

function renderExamTimeline(container, dataset) {
    const fragment = document.createDocumentFragment();

    dataset.forEach(exam => {
        const card = document.createElement("div");
        card.className = "class-card fade-in";
        const color = getDeterministicColor(exam.courseCode);

        // Calculate countdown to exam date
        const countdownStr = getExamCountdownString(exam.date, exam.startTime);

        card.innerHTML = `
            <div class="course-glow-bar" style="background-color: ${color};"></div>
            <div class="class-card-body">
                <div class="card-top-row">
                    <span class="course-badge" style="background-color: ${color}15; color: ${color};">${exam.courseCode}</span>
                    <span class="time-badge" style="color: var(--danger); font-weight: 800;">${countdownStr}</span>
                </div>
                <h4 class="class-title">${exam.courseTitle}</h4>
                <div class="details-row">
                    <div class="meta-item"><span class="meta-label">Date:</span> ${exam.date}</div>
                    <div class="meta-item"><span class="meta-label">Time:</span> ${exam.startTime} (${exam.duration})</div>
                    <div class="meta-item" style="grid-column: span 2;"><span class="meta-label">Venue:</span> ${exam.venue}</div>
                </div>
                <div class="card-actions-row">
                    <div class="edit-actions"><button class="icon-action-btn" onclick="window.editClassModal('${exam.id}')" title="Edit Exam">✎</button><button class="icon-action-btn delete-icon" onclick="window.triggerDeleteModal('${exam.id}')" title="Delete Exam">×</button></div>
                </div>
            </div>
        `;
        fragment.appendChild(card);
    });

    container.appendChild(fragment);
}

// =========================================================================
// 8. COGNITIVE UTILITIES (COUNTDOWNS, COLORS, ACTIVE STATUS)
// =========================================================================
function getDeterministicColor(str) {
    const colors = ["#8b5cf6", "#ec4899", "#22c55e", "#f59e0b", "#3b82f6", "#06b6d4", "#f97316"];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

function calculateTodayClassesCount(dataset) {
    const currentDay = getCurrentDayName();
    return dataset.filter(item => item.day === currentDay).length;
}

function getCurrentDayName() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
}

function isClassCurrentlyActive(item) {
    if (item.day !== getCurrentDayName()) return false;

    const now = new Date();
    const currentMinutes = (now.getHours() * 60) + now.getMinutes();

    const [startH, startM] = item.startTime.split(":").map(Number);
    const [endH, endM] = item.endTime.split(":").map(Number);

    const startMinutes = (startH * 60) + startM;
    const endMinutes = (endH * 60) + endM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function getExamCountdownString(dateStr, timeStr) {
    const examDate = new Date(`${dateStr}T${timeStr}:00`);
    const now = new Date();
    const diff = examDate - now;

    if (diff <= 0) return "Exam Passed";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
        return `${days}d ${hours}h left`;
    }
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m left`;
}

// =========================================================================
// 9. SMART SCHEDULING (TICKING ENGINE)
// =========================================================================
function evaluateSmartSchedule() {
    const smartTitle = document.getElementById("smart-title");
    const smartSub = document.getElementById("smart-sub");
    const ringText = document.getElementById("ring-text");
    const ring = document.getElementById("countdown-ring");

    if (!smartTitle || !smartSub) return;

    let dataset = getActiveCollection();
    if (dataset.length === 0) {
        smartTitle.textContent = "No classes compiled";
        smartSub.textContent = "Setup personal timeline courses.";
        if (ringText) ringText.textContent = "--";
        return;
    }

    const todayName = getCurrentDayName();
    const todayClasses = dataset.filter(c => c.day === todayName);

    if (todayClasses.length === 0) {
        smartTitle.textContent = "No classes today! 🥳";
        smartSub.textContent = "Enjoy your free periods or study.";
        if (ringText) ringText.textContent = "Free";
        if (ring) ring.style.strokeDashoffset = "100";
        return;
    }

    const now = new Date();
    const currentMins = (now.getHours() * 60) + now.getMinutes();

    let activeClass = null;
    let nextClass = null;

    todayClasses.forEach(c => {
        const [startH, startM] = c.startTime.split(":").map(Number);
        const [endH, endM] = c.endTime.split(":").map(Number);
        const startMins = (startH * 60) + startM;
        const endMins = (endH * 60) + endM;

        if (currentMins >= startMins && currentMins <= endMins) {
            activeClass = c;
        } else if (startMins > currentMins) {
            if (!nextClass) {
                nextClass = c;
            } else {
                const [nStartH, nStartM] = nextClass.startTime.split(":").map(Number);
                const nStartMins = (nStartH * 60) + nStartM;
                if (startMins < nStartMins) {
                    nextClass = c;
                }
            }
        }
    });

    if (activeClass) {
        smartTitle.textContent = `Current: ${activeClass.courseCode}`;
        smartSub.textContent = `Ongoing at ${activeClass.venue}`;

        // Calculate progress percentage through class duration
        const [startH, startM] = activeClass.startTime.split(":").map(Number);
        const [endH, endM] = activeClass.endTime.split(":").map(Number);
        const startMins = (startH * 60) + startM;
        const endMins = (endH * 60) + endM;
        const totalDuration = endMins - startMins;
        const elapsed = currentMins - startMins;
        const pct = Math.max(0, Math.min(100, Math.round((elapsed / totalDuration) * 100)));

        if (ringText) ringText.textContent = `${pct}%`;
        if (ring) {
            const offset = 100 - pct;
            ring.style.strokeDashoffset = offset;
        }
    } else if (nextClass) {
        smartTitle.textContent = `Next: ${nextClass.courseCode}`;
        const [nStartH, nStartM] = nextClass.startTime.split(":").map(Number);
        const nextStartMins = (nStartH * 60) + nStartM;
        const minDiff = nextStartMins - currentMins;

        smartSub.textContent = `Starts in ${minDiff} minutes at ${nextClass.venue}`;
        if (ringText) ringText.textContent = `${minDiff}m`;
        if (ring) ring.style.strokeDashoffset = "0";
    } else {
        smartTitle.textContent = "Done with lectures! 🎉";
        smartSub.textContent = "All scheduled sessions completed.";
        if (ringText) ringText.textContent = "Done";
        if (ring) ring.style.strokeDashoffset = "100";
    }
}

function startClockTicks() {
    if (State.clockInterval) clearInterval(State.clockInterval);
    State.clockInterval = setInterval(() => {
        evaluateSmartSchedule();
    }, 60000); // Ticks every minute
}

// =========================================================================
// 10. PRODUCTIVITY CHECKLISTS MANAGER
// =========================================================================
window.triggerProductivity = function(classId) {
    const modal = document.getElementById("productivity-modal");
    const classItem = State.classes.find(c => c.id === classId);
    if (!modal || !classItem) return;

    State.activeProductivityId = classId;
    document.getElementById("prod-class-id").value = classId;

    // Load active notes
    document.getElementById("prod-notes").value = classItem.notes || "";

    // Synchronize attendance button styling
    const attendBtn = document.getElementById("prod-attendance-toggle");
    if (classItem.attended === true) {
        attendBtn.textContent = "Yes";
        attendBtn.classList.add("active");
    } else {
        attendBtn.textContent = "No";
        attendBtn.classList.remove("active");
    }

    renderChecklist(classItem.checklist || []);
    modal.classList.add("active");
};

function renderChecklist(todos) {
    const container = document.getElementById("prod-checklist-container");
    if (!container) return;

    container.innerHTML = "";
    todos.forEach((todo, idx) => {
        const item = document.createElement("div");
        item.className = "checklist-item";
        item.innerHTML = `
            <span class="checklist-text ${todo.done ? 'done' : ''}" onclick="window.toggleTodoState(${idx})">
                ${todo.done ? '✓' : '○'} ${todo.text}
            </span>
            <button class="remove-todo-btn" onclick="window.removeTodoState(${idx})">&times;</button>
        `;
        container.appendChild(item);
    });
}

// Expose handlers globally
window.toggleTodoState = function(index) {
    const classItem = State.classes.find(c => c.id === State.activeProductivityId);
    if (!classItem) return;

    classItem.checklist[index].done = !classItem.checklist[index].done;
    renderChecklist(classItem.checklist);
};

window.removeTodoState = function(index) {
    const classItem = State.classes.find(c => c.id === State.activeProductivityId);
    if (!classItem) return;

    classItem.checklist.splice(index, 1);
    renderChecklist(classItem.checklist);
};

// =========================================================================
// 11. BOOTSTRAPPING EVENT BINDINGS
// =========================================================================
function toggleSkeleton(show) {
    const loader = document.getElementById("skeleton-loader");
    if (loader) {
        loader.style.display = show ? "flex" : "none";
    }
}

function updateDashboardMetrics(total, today) {
    const tEl = document.getElementById("stat-total-classes");
    const dEl = document.getElementById("stat-today-classes");
    const nEl = document.getElementById("stat-next-countdown");
    const nLabel = document.getElementById("stat-next-label");

    if (tEl) tEl.textContent = total;
    if (dEl) dEl.textContent = today;

    // Find next upcoming class in chronological order
    let dataset = getActiveCollection();
    if (dataset.length > 0 && State.activeTab !== "exam") {
        const currentDay = getCurrentDayName();
        const now = new Date();
        const currentMins = (now.getHours() * 60) + now.getMinutes();

        const upcoming = dataset
            .filter(c => c.day === currentDay)
            .map(c => {
                const [h, m] = c.startTime.split(":").map(Number);
                return { item: c, mins: (h * 60) + m };
            })
            .filter(c => c.mins > currentMins)
            .sort((a, b) => a.mins - b.mins);

        if (upcoming.length > 0) {
            const next = upcoming[0].item;
            if (nEl) nEl.textContent = next.startTime;
            if (nLabel) nLabel.textContent = `Next: ${next.courseCode}`;
        } else {
            if (nEl) nEl.textContent = "--:--";
            if (nLabel) nLabel.textContent = "No more classes";
        }
    } else {
        if (nEl) nEl.textContent = "--:--";
        if (nLabel) nLabel.textContent = "Inactive";
    }
}

// Global modal triggers
window.editClassModal = function(id) {
    const modal = document.getElementById("class-modal");
    const item = [...State.classes, ...State.lectureTimetable, ...State.examTimetable].find(c => c.id === id);
    if (!modal || !item) return;

    State.selectedEditId = id;
    document.getElementById("modal-title").textContent = item.type === "exam" ? "Edit Exam" : item.type === "lecture" ? "Edit Lecture" : "Modify Class Session";
    document.getElementById("form-edit-id").value = id;
    document.getElementById("form-course-code").value = item.courseCode;
    document.getElementById("form-course-title").value = item.courseTitle;
    document.getElementById("form-lecturer").value = item.lecturer;
    document.getElementById("form-venue").value = item.venue;
    document.getElementById("form-day").value = item.day || "Monday";
    const dateField = document.getElementById("form-exam-date");
    if (dateField) dateField.value = item.date || "";
    document.getElementById("form-start-time").value = item.startTime;
    document.getElementById("form-end-time").value = item.endTime;
    document.getElementById("form-description").value = item.description || "";
    document.getElementById("form-day-group").style.display = item.type === "exam" ? "none" : "";
    document.getElementById("form-exam-date-group").style.display = item.type === "exam" ? "" : "none";

    modal.classList.add("active");
};

window.triggerDeleteModal = function(id) {
    const modal = document.getElementById("confirm-delete-modal");
    if (!modal) return;
    State.selectedDeleteId = id;
    modal.classList.add("active");
};

// =========================================================================
// DOM EVENT BINDINGS
// =========================================================================
const initializeTimetablePage = () => {
    // Prevent the status badge from remaining on Connecting indefinitely.
    const authStatusTimer = setTimeout(() => {
        const txt = document.getElementById("status-text");
        if (txt && txt.textContent === "Connecting...") {
            txt.textContent = "Local Mode";
            const dot = document.querySelector(".status-dot");
            if (dot) dot.className = "status-dot offline";
            toggleSkeleton(false);
            loadOfflineMockData();
            console.warn("FundsIQ timetable: Firebase auth did not respond within 8 seconds; local mode enabled.");
        }
    }, 8000);

    // 1. Monitor Authentication sessions
    onAuthStateChanged(auth, (user) => {
        clearTimeout(authStatusTimer);
        const dot = document.querySelector(".status-dot");
        const txt = document.getElementById("status-text");

        if (user) {
            State.user = user;
            if (dot) { dot.className = "status-dot online"; }
            if (txt) txt.textContent = "Cloud Sync";
            subscribeToFirestoreTimetable(user);
        } else {
            State.user = null;
            if (dot) { dot.className = "status-dot offline"; }
            if (txt) txt.textContent = "Offline Mode";
            toggleSkeleton(false);
            loadOfflineMockData();
        }
    });

    // 2. Tab selection navigation bindings
    const tabButtons = document.querySelectorAll(".type-tabs .tab-btn");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            State.activeTab = btn.getAttribute("data-tab");
            const examMode = State.activeTab === 'exam';
            document.getElementById('form-day-group').style.display = examMode ? 'none' : '';
            document.getElementById('form-exam-date-group').style.display = examMode ? '' : 'none';
            document.getElementById('filter-day').disabled = examMode;
            
            // Adjust search query and render state
            renderSchedule();
            evaluateSmartSchedule();
        });
    });

    // 3. View mode triggers
    const viewButtons = document.querySelectorAll(".view-toggle-buttons .view-btn");
    viewButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            viewButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            State.activeView = btn.getAttribute("data-view");
            renderSchedule();
        });
    });

    // 4. Dropdown filtering
    const dayFilter = document.getElementById("filter-day");
    if (dayFilter) {
        dayFilter.addEventListener("change", (e) => {
            State.filterDay = e.target.value;
            renderSchedule();
        });
    }

    // 5. Live incremental searches
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            State.searchQuery = e.target.value;
            renderSchedule();
        });
    }

    // 6. Floating Action Add Class triggers
    const fab = document.getElementById("fab-add-class");
    const classModal = document.getElementById("class-modal");
    if (fab && classModal) {
        fab.addEventListener("click", () => {
            State.selectedEditId = null;
            document.getElementById("class-form").reset();
            document.getElementById("form-edit-id").value = "";
            const examMode = State.activeTab === "exam";
            document.getElementById("modal-title").textContent = examMode ? "Add Exam" : State.activeTab === "lecture" ? "Add Lecture" : "Schedule New Class";
            document.getElementById("form-day-group").style.display = examMode ? "none" : "";
            document.getElementById("form-exam-date-group").style.display = examMode ? "" : "none";
            classModal.classList.add("active");
        });
    }

    // 7. Modals close triggers
    document.getElementById("close-class-modal")?.addEventListener("click", () => {
        classModal.classList.remove("active");
    });

    const prodModal = document.getElementById("productivity-modal");
    document.getElementById("close-prod-modal")?.addEventListener("click", () => {
        prodModal.classList.remove("active");
    });

    // 8. Class Submission Forms handlers
    const classForm = document.getElementById("class-form");
    if (classForm) {
        classForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const data = {
                courseCode: document.getElementById("form-course-code").value.trim().toUpperCase(),
                courseTitle: document.getElementById("form-course-title").value.trim(),
                lecturer: document.getElementById("form-lecturer").value.trim(),
                venue: document.getElementById("form-venue").value.trim(),
                type: State.activeTab,
                day: State.activeTab === "exam" ? "" : document.getElementById("form-day").value,
                date: State.activeTab === "exam" ? document.getElementById("form-exam-date").value : "",
                duration: State.activeTab === "exam" ? document.getElementById("form-duration").value.trim() : "",
                startTime: document.getElementById("form-start-time").value,
                endTime: document.getElementById("form-end-time").value,
                description: document.getElementById("form-description").value.trim()
            };

            try {
                if (State.activeTab === "exam" && !data.date) { showToast("Please choose the exam date.", "error"); return; }
                await saveClassSession(data);
                classModal.classList.remove("active");
            } catch (err) {
                console.error("Failed to write to database:", err);
                showToast("Action failed. Verification required.", "error");
            }
        });
    }

    // 9. Attendance button toggles
    const attendToggle = document.getElementById("prod-attendance-toggle");
    if (attendToggle) {
        attendToggle.addEventListener("click", () => {
            const classItem = State.classes.find(c => c.id === State.activeProductivityId);
            if (!classItem) return;

            classItem.attended = !classItem.attended;
            if (classItem.attended) {
                attendToggle.textContent = "Yes";
                attendToggle.classList.add("active");
            } else {
                attendToggle.textContent = "No";
                attendToggle.classList.remove("active");
            }
        });
    }

    // 10. Checklist builder items adder
    document.getElementById("btn-add-todo")?.addEventListener("click", () => {
        const input = document.getElementById("prod-new-todo");
        const classItem = State.classes.find(c => c.id === State.activeProductivityId);
        if (!input || !classItem || input.value.trim() === "") return;

        if (!classItem.checklist) classItem.checklist = [];
        classItem.checklist.push({ text: input.value.trim(), done: false });
        input.value = "";
        renderChecklist(classItem.checklist);
    });

    // 11. Productivity details save
    document.getElementById("prod-save-btn")?.addEventListener("click", async () => {
        const notes = document.getElementById("prod-notes").value.trim();
        const classItem = State.classes.find(c => c.id === State.activeProductivityId);
        if (!classItem) return;

        classItem.notes = notes;
        
        try {
            if (auth.currentUser) {
                const path = `users/${auth.currentUser.uid}/timetable`;
                const docRef = doc(db, path, State.activeProductivityId);
                await updateDoc(docRef, {
                    attended: classItem.attended || false,
                    notes: classItem.notes || "",
                    checklist: classItem.checklist || []
                });
                showToast("Productivity updates synced to cloud.");
            } else {
                const key = "offline_timetable_mock";
                localStorage.setItem(key, JSON.stringify(State.classes));
                showToast("Local productivity metrics saved.");
                renderSchedule();
            }
            prodModal.classList.remove("active");
        } catch (err) {
            console.error("Failed to store productivity updates:", err);
            showToast("Failed to save metrics.", "error");
        }
    });

    // 12. Deletion Confirmation Actions
    document.getElementById("cancel-delete-btn")?.addEventListener("click", () => {
        document.getElementById("confirm-delete-modal").classList.remove("active");
    });

    document.getElementById("confirm-delete-btn")?.addEventListener("click", async () => {
        if (!State.selectedDeleteId) return;

        try {
            await deleteClassSession(State.selectedDeleteId);
            document.getElementById("confirm-delete-modal").classList.remove("active");
        } catch (err) {
            console.error("Failed to complete session deletion:", err);
            showToast("Failed to complete deletion.", "error");
        }
    });

    // 13. Pull to Refresh Gesture Simulator
    let startY = 0;
    const container = document.querySelector(".timetable-wrapper");
    const pullIndicator = document.getElementById("pull-to-refresh");

    if (container && pullIndicator) {
        container.addEventListener("touchstart", (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].pageY;
            }
        }, { passive: true });

        container.addEventListener("touchmove", (e) => {
            const currentY = e.touches[0].pageY;
            const diff = currentY - startY;

            if (window.scrollY === 0 && diff > 70 && startY !== 0) {
                pullIndicator.classList.add("active");
            }
        }, { passive: true });

        container.addEventListener("touchend", () => {
            if (pullIndicator.classList.contains("active")) {
                setTimeout(() => {
                    pullIndicator.classList.remove("active");
                    renderSchedule();
                    evaluateSmartSchedule();
                    showToast("Schedule updated.");
                }, 1000);
            }
            startY = 0;
        });
    }

    window.addEventListener("online", syncPendingTimetableChanges);
    if (navigator.onLine) syncPendingTimetableChanges();
    // Start background clock processes
    startClockTicks();
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeTimetablePage, { once: true });
} else {
    initializeTimetablePage();
}
