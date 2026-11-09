import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc,
    updateDoc,
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// ==========================================
// COIN SYSTEM
// ==========================================

async function payForExam() {

    if (typeof window.spendCoins !== "function") {
        alert("Coin system is not ready. Please refresh and try again.");
        return false;
    }

    try {
        const paid = await window.spendCoins(
            10,
            `${selectedMode} Attempt`
        );

        return paid === true;

    } catch (error) {

        console.error("FundsIQ payment error:", error);

        alert(
            "We couldn't verify your coin balance. " +
            "Check your internet connection and try again."
        );

        return false;
    }
}

// ==========================================
// COURSE DICTIONARY
// ==========================================

const COURSE_TITLES = {
    gst101: "GST 101 – Use of English & Library",
    gst102: "GST 102 – Philosophy & Human Existence",
    gst103: "GST 103 – DELSU Culture & Ethics",
    gst111: "GST 111 – Nigerian Peoples, Culture & Entrepreneurial Skills",
    gst112: "GST 112 – History & Philosophy of Science and Technology",
    gst113: "GST 113 – Peace Studies & Conflict Resolution",
    gst114: "GST 114 – Communication in French"
};

// ==========================================
// STATE VARIABLES
// ==========================================

let questions = [];
let currentQuestion = 0;
let answers = [];
let review = [];
let timerInterval = null;
let timeLeft = 0;

let isSubmitting = false;
let examStartTime = 0;

let selectedCourse = "";
let selectedQuestionsCount = 50;
let selectedMode = "Exam";

// ==========================================
// COURSE RESOLUTION
// ==========================================

function getSelectedCourse() {

    try {

        const params = new URLSearchParams(window.location.search);

        let course =
            params.get("course") ||
            localStorage.getItem("selectedCourse") ||
            localStorage.getItem("course") ||
            "gst101";

        return course
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .trim();

    } catch (error) {

        console.warn("Course resolution error:", error);

        return "gst101";
    }
}

// ==========================================
// PAGE INITIALIZATION
// ==========================================

function initPage() {

    if (window.pageInitialized) return;

    window.pageInitialized = true;

    selectedCourse = getSelectedCourse();

    const courseTitle =
        COURSE_TITLES[selectedCourse] ||
        selectedCourse.toUpperCase();

    const titleEl = document.getElementById("setup-course-title");

    if (titleEl) {
        titleEl.innerText = courseTitle;
    }

    const gridButtons = document.querySelectorAll(".grid-btn");

    gridButtons.forEach(btn => {

        btn.addEventListener("click", () => {

            gridButtons.forEach(b => {

                b.classList.remove("active");

                const check = b.querySelector(".check-mark");

                if (check) check.remove();

            });

            btn.classList.add("active");

            const rawVal = btn.getAttribute("data-value");

            if (rawVal === "CUSTOM") {

                const customVal = prompt(
                    "Enter custom number of questions:"
                );

                if (
                    customVal &&
                    !isNaN(customVal) &&
                    parseInt(customVal, 10) > 0
                ) {

                    selectedQuestionsCount = parseInt(customVal, 10);

                    btn.innerHTML =
                        `${selectedQuestionsCount} <span class="check-mark">✓</span>`;

                } else {

                    const defaultBtn =
                        document.querySelector('[data-value="50"]');

                    if (defaultBtn) {

                        defaultBtn.classList.add("active");

                        if (!defaultBtn.querySelector(".check-mark")) {
                            defaultBtn.innerHTML +=
                                ' <span class="check-mark">✓</span>';
                        }
                    }

                    selectedQuestionsCount = 50;
                }

            } else {

                selectedQuestionsCount = parseInt(rawVal, 10);

                btn.innerHTML =
                    `${rawVal} <span class="check-mark">✓</span>`;
            }

        });

    });

    const examScreen = document.getElementById("exam-screen");
    const setupScreen = document.getElementById("setup-screen");

    if (examScreen) examScreen.style.display = "none";

    if (setupScreen) setupScreen.style.display = "block";
}

// DOM READY

if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", initPage);

} else {

    initPage();
}

// ==========================================
// MODE SELECTION
// ==========================================

function setMode(mode) {

    selectedMode = mode;

    document.querySelectorAll(".mode-card").forEach(card => {
        card.classList.remove("active");
    });

    if (mode === "Exam") {

        const examEl = document.getElementById("mode-exam");

        if (examEl) examEl.classList.add("active");

    } else if (mode === "Quiz") {

        const quizEl = document.getElementById("mode-quiz");

        if (quizEl) quizEl.classList.add("active");
    }
}

// ==========================================
// START EXAM
// ==========================================

async function startExam() {

    if (window.examStarting) return;

    window.examStarting = true;

    const startButton = document.querySelector(".start-btn-green");

    if (startButton) {
        startButton.disabled = true;
        startButton.dataset.originalText = startButton.innerText;
        startButton.innerText = "Starting...";
    }

    try {

        // Check question database

        if (
            typeof QUESTIONS === "undefined" ||
            !Array.isArray(QUESTIONS)
        ) {

            throw new Error(
                "Questions could not load. Please refresh the page."
            );
        }

        // Resolve selected course

        selectedCourse = getSelectedCourse();

        if (!COURSE_TITLES[selectedCourse]) {

            throw new Error(
                "Invalid course. Return to Courses and select it again."
            );
        }

        const params = new URLSearchParams(window.location.search);

        const chapter = params.get("chapter");

        // Validate duration before payment

        const hrs = parseInt(
            document.getElementById("time-hours")?.value,
            10
        ) || 0;

        const mins = parseInt(
            document.getElementById("time-minutes")?.value,
            10
        ) || 0;

        const totalMinutes = (hrs * 60) + mins;

        if (selectedMode === "Exam" && totalMinutes <= 0) {

            throw new Error(
                "Please select a valid exam duration."
            );
        }

        // Filter valid questions for selected course

        let matchedQuestions = QUESTIONS.filter(q => {

            if (!q || typeof q.course !== "string") {
                return false;
            }

            const course = q.course
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");

            if (course !== selectedCourse) {
                return false;
            }

            if (
                chapter &&
                Number(q.chapter) !== Number(chapter)
            ) {
                return false;
            }

            return (
                typeof q.question === "string" &&
                q.question.trim().length > 0 &&
                Array.isArray(q.options) &&
                q.options.length >= 2 &&
                Number.isInteger(Number(q.answer)) &&
                Number(q.answer) >= 0 &&
                Number(q.answer) < q.options.length
            );

        });

        if (matchedQuestions.length === 0) {

            throw new Error(
                "No valid questions were found for " +
                selectedCourse.toUpperCase() +
                (chapter ? " in this chapter." : ".")
            );
        }

        // Normalize answer values

        matchedQuestions = matchedQuestions.map(q => ({
            ...q,
            answer: Number(q.answer)
        }));

        // Shuffle questions

        for (
            let i = matchedQuestions.length - 1;
            i > 0;
            i--
        ) {

            const j = Math.floor(Math.random() * (i + 1));

            [
                matchedQuestions[i],
                matchedQuestions[j]
            ] = [
                matchedQuestions[j],
                matchedQuestions[i]
            ];
        }

        // Select question count

        const count = Math.max(
            1,
            parseInt(selectedQuestionsCount, 10) || 50
        );

        questions = matchedQuestions.slice(0, count);

        // Payment

        const payment = await payForExam();

        if (!payment) return;

        // Reset exam state

        currentQuestion = 0;

        answers = [];

        review = [];

        timeLeft = (
            selectedMode === "Exam"
                ? totalMinutes
                : 0
        ) * 60;

        examStartTime = Date.now();

        // Update mode label

        const modeEl = document.getElementById("mode");

        if (modeEl) {
            modeEl.innerText = selectedMode + " Mode";
        }

        // Show exam screen

        const setupScreen = document.getElementById("setup-screen");

        const examScreen = document.getElementById("exam-screen");

        if (!setupScreen || !examScreen) {

            throw new Error(
                "Exam screen could not load. Please refresh."
            );
        }

        setupScreen.style.display = "none";

        examScreen.style.display = "block";

        // Timer

        if (selectedMode === "Exam") {

            startTimer();

        } else {

            const timerEl = document.getElementById("timer");

            if (timerEl) {
                timerEl.innerText = "♾️ Unlimited";
            }
        }

        // Load first question

        loadQuestion();

    } catch (error) {

        console.error(
            "FundsIQ Start Exam Error:",
            error
        );

        alert(
            error.message ||
            "Unable to start. Please refresh and try again."
        );

    } finally {

        window.examStarting = false;

        if (startButton) {

            startButton.disabled = false;

            startButton.innerText =
                startButton.dataset.originalText || "Start Exam";
        }
    }
}

// ==========================================
// LOAD QUESTION
// ==========================================

function loadQuestion() {

    if (questions.length === 0) {

        const questionBox = document.getElementById("question-box");

        if (questionBox) {
            questionBox.innerHTML = "<h3>No questions found.</h3>";
        }

        return;
    }

    const q = questions[currentQuestion];

    if (!q) return;

    const numberEl = document.getElementById("question-number");

    const questionBox = document.getElementById("question-box");

    const progressEl = document.getElementById("progress");

    if (numberEl) {
        numberEl.innerText = `Question ${currentQuestion + 1}`;
    }

    if (questionBox) {
        questionBox.innerText = q.question;
    }

    if (progressEl) {
        progressEl.innerText =
            `Question ${currentQuestion + 1} / ${questions.length}`;
    }

    let html = "";

    const letters = ["A", "B", "C", "D", "E", "F"];

    q.options.forEach((option, i) => {

        let styleStr = "";

        if (answers[currentQuestion] !== undefined) {

            if (selectedMode === "Quiz") {

                if (i === q.answer) {

                    styleStr =
                        "style='background:#22c55e;color:#fff;border-color:#22c55e;'";

                } else if (answers[currentQuestion] === i) {

                    styleStr =
                        "style='background:#ef4444;color:#fff;border-color:#ef4444;'";
                }

            } else {

                if (answers[currentQuestion] === i) {

                    styleStr =
                        "style='background:#2563eb;color:#fff;'";
                }
            }
        }

        const letter = letters[i] || String(i + 1);

        html += `
            <button class="btn option-btn"
                ${styleStr}
                onclick="answer(${i})">
                <strong>${letter}.</strong> ${option}
            </button><br><br>
        `;

    });

    const optionsEl = document.getElementById("options");

    if (optionsEl) {
        optionsEl.innerHTML = html;
    }

    const reviewStatus = document.getElementById("review-status");

    if (reviewStatus) {

        reviewStatus.innerText = review.includes(currentQuestion)
            ? "⭐ Flagged for Review"
            : "";
    }

    updateProgressBar();

    createPalette();

    updateNextButton();
}

// ==========================================
// ANSWER QUESTION
// ==========================================

function answer(choice) {

    if (
        selectedMode === "Quiz" &&
        answers[currentQuestion] !== undefined
    ) {
        return;
    }

    answers[currentQuestion] = choice;

    loadQuestion();
}

// ==========================================
// NAVIGATION
// ==========================================

function nextQuestion() {

    if (currentQuestion < questions.length - 1) {

        currentQuestion++;

        loadQuestion();
    }
}

function prevQuestion() {

    if (currentQuestion > 0) {

        currentQuestion--;

        loadQuestion();
    }
}

// ==========================================
// REVIEW TOGGLE
// ==========================================

function markForReview() {

    const index = review.indexOf(currentQuestion);

    if (index > -1) {

        review.splice(index, 1);

    } else {

        review.push(currentQuestion);
    }

    loadQuestion();
}

// ==========================================
// PROGRESS BAR
// ==========================================

function updateProgressBar() {

    const fill = document.getElementById("progress-fill");

    if (!fill || questions.length === 0) return;

    const percent =
        ((currentQuestion + 1) / questions.length) * 100;

    fill.style.width = percent + "%";
}

// ==========================================
// NEXT BUTTON
// ==========================================

function updateNextButton() {

    const nextBtn = document.getElementById("next-btn");

    if (!nextBtn) return;

    nextBtn.onclick = null;

    if (currentQuestion === questions.length - 1) {

        nextBtn.innerHTML = "📝 Submit Exam";

        nextBtn.onclick = finishExam;

        nextBtn.style.background = "#16a34a";

    } else {

        nextBtn.innerHTML = "Next ➡";

        nextBtn.onclick = nextQuestion;

        nextBtn.style.background = "#374151";
    }
}

// ==========================================
// QUESTION PALETTE
// ==========================================

function createPalette() {

    const palette = document.getElementById("question-palette");

    if (!palette) return;

    palette.innerHTML = "";

    questions.forEach((q, i) => {

        const btn = document.createElement("button");

        btn.innerText = i + 1;

        btn.className = "palette-btn";

        if (answers[i] !== undefined) {

            btn.style.background = "#22c55e";

            btn.style.color = "#fff";
        }

        if (review.includes(i)) {

            btn.style.background = "#f59e0b";

            btn.style.color = "#fff";
        }

        if (i === currentQuestion) {

            btn.style.border = "3px solid #3b82f6";
        }

        btn.onclick = function () {

            currentQuestion = i;

            loadQuestion();
        };

        palette.appendChild(btn);
    });
}

// ==========================================
// TIMER
// ==========================================

function startTimer() {

    clearInterval(timerInterval);

    updateTimerDisplay();

    timerInterval = setInterval(() => {

        if (timeLeft <= 0) {

            clearInterval(timerInterval);

            finishExam(true);

            return;
        }

        timeLeft--;

        updateTimerDisplay();

    }, 1000);
}

// ==========================================
// TIMER DISPLAY
// ==========================================

function updateTimerDisplay() {

    const hrs = Math.floor(timeLeft / 3600);

    const mins = Math.floor((timeLeft % 3600) / 60);

    const secs = timeLeft % 60;

    const timerEl = document.getElementById("timer");

    if (!timerEl) return;

    if (hrs > 0) {

        timerEl.innerText =
            `⏰ ${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    } else {

        timerEl.innerText =
            `⏰ ${mins}:${String(secs).padStart(2, "0")}`;
    }
}

// ==========================================
// FINISH EXAM
// ==========================================

async function finishExam(autoSubmit = false) {

    if (isSubmitting) return;

    if (!questions.length) return;

    if (!autoSubmit) {

        if (!confirm("Are you sure you want to submit your exam?")) {
            return;
        }
    }

    isSubmitting = true;

    clearInterval(timerInterval);

    const submitBtn =
        document.getElementById("next-btn") ||
        document.querySelector(".submit-btn");

    if (submitBtn) {

        submitBtn.disabled = true;

        submitBtn.innerHTML = "⏳ Submitting...";

        submitBtn.style.opacity = "0.7";

        submitBtn.style.cursor = "not-allowed";
    }

    // Calculate scores

    const totalQuestions = questions.length;

    let correctAnswers = 0;

    questions.forEach((q, i) => {

        if (answers[i] === q.answer) {
            correctAnswers++;
        }
    });

    const wrongAnswers =
        Math.max(0, totalQuestions - correctAnswers);

    const percentage = Number(
        ((correctAnswers / totalQuestions) * 100).toFixed(1)
    );

    // Unanswered questions

    let unansweredCount = 0;

    for (let i = 0; i < totalQuestions; i++) {

        if (
            answers[i] === undefined ||
            answers[i] === null
        ) {
            unansweredCount++;
        }
    }

    // Duration

    let examDuration = 0;

    if (examStartTime > 0) {

        examDuration = Math.max(
            1,
            Math.round((Date.now() - examStartTime) / 1000)
        );

    } else {

        const hrsEl = document.getElementById("time-hours");

        const minsEl = document.getElementById("time-minutes");

        const hrs = hrsEl ? (parseInt(hrsEl.value) || 0) : 0;

        const mins = minsEl ? (parseInt(minsEl.value) || 0) : 0;

        const totalSecs = ((hrs * 60) + mins) * 60;

        examDuration = Math.max(1, totalSecs - timeLeft);
    }

    // Format duration

    const formatTimeSpent = (totalSecs) => {

        const h = Math.floor(totalSecs / 3600);

        const m = Math.floor((totalSecs % 3600) / 60);

        const s = totalSecs % 60;

        return (
            `${h}:${String(m).padStart(2, "0")}:` +
            `${String(s).padStart(2, "0")}`
        );
    };

    const timeSpentFormatted =
        formatTimeSpent(examDuration);

    // Chapter statistics

    const chaptersMap = {};

    questions.forEach((q, i) => {

        const chap = q.chapter || 1;

        if (!chaptersMap[chap]) {

            chaptersMap[chap] = {
                correct: 0,
                total: 0
            };
        }

        chaptersMap[chap].total++;

        if (answers[i] === q.answer) {
            chaptersMap[chap].correct++;
        }
    });

    const chapterResults = {};

    const strongChapters = [];

    const weakChapters = [];

    Object.keys(chaptersMap).forEach(chap => {

        const stats = chaptersMap[chap];

        const pct = Math.round(
            (stats.correct / stats.total) * 100
        );

        chapterResults[chap] = pct;

        if (pct >= 70) {

            strongChapters.push(Number(chap));

        } else if (pct < 50) {

            weakChapters.push(Number(chap));
        }
    });

    // Save local results

    try {

        localStorage.setItem("score", correctAnswers);

        localStorage.setItem("total", totalQuestions);

        localStorage.setItem("course", selectedCourse);

        localStorage.setItem(
            "examQuestions",
            JSON.stringify(questions)
        );

        localStorage.setItem(
            "examAnswers",
            JSON.stringify(answers)
        );

        localStorage.setItem("unanswered", unansweredCount);

        localStorage.setItem(
            "durationFormatted",
            timeSpentFormatted
        );

    } catch (error) {

        console.warn("LocalStorage save failed:", error);
    }

    // Firestore submission

    let examId = "offline_" + Date.now();

    const user = auth.currentUser;

    if (user) {

        try {

            const resultsRef = collection(
                db,
                `users/${user.uid}/results`
            );

            const docRef = await addDoc(resultsRef, {

                course: selectedCourse,

                courseTitle:
                    COURSE_TITLES[selectedCourse] ||
                    selectedCourse.toUpperCase(),

                score: correctAnswers,

                correct: correctAnswers,

                wrong: wrongAnswers,

                unanswered: unansweredCount,

                totalQuestions: totalQuestions,

                percentage: percentage,

                mode: selectedMode,

                duration: examDuration,

                durationFormatted: timeSpentFormatted,

                chapterResults: chapterResults,

                strongChapters: strongChapters,

                weakChapters: weakChapters,

                date: serverTimestamp()
            });

            examId = docRef.id;

            // Exam history

            const examHistoryRef = collection(
                db,
                `users/${user.uid}/examHistory`
            );

            await addDoc(examHistoryRef, {

                course: selectedCourse,

                courseTitle:
                    COURSE_TITLES[selectedCourse] ||
                    selectedCourse.toUpperCase(),

                score: correctAnswers,

                totalQuestions: totalQuestions,

                correct: correctAnswers,

                wrong: wrongAnswers,

                unanswered: unansweredCount,

                percentage: percentage,

                grade:
                    percentage >= 70 ? "A" :
                    percentage >= 60 ? "B" :
                    percentage >= 50 ? "C" :
                    percentage >= 45 ? "D" : "F",

                mode: selectedMode,

                duration: examDuration,

                durationFormatted: timeSpentFormatted,

                chapterResults: chapterResults,

                strongChapters: strongChapters,

                weakChapters: weakChapters,

                completedAt: serverTimestamp()
            });

            // Update user statistics

            const userRef = doc(db, "users", user.uid);

            const snap = await getDoc(userRef);

            if (snap.exists()) {

                const data = snap.data();

                const courseField = selectedCourse + "Score";

                const totalScoreAccumulated =
                    (data.totalScore || 0) + correctAnswers;

                const newCompletedTests =
                    (data.completedTests || 0) + 1;

                const oldAvg = data.averageScore || 0;

                const newAvg = Number(
                    (
                        (
                            oldAvg * (newCompletedTests - 1) +
                            percentage
                        ) / newCompletedTests
                    ).toFixed(1)
                );

                const currentBest = data.bestScore || 0;

                const newBest = Math.max(
                    currentBest,
                    percentage
                );

                await updateDoc(userRef, {

                    completedTests: newCompletedTests,

                    totalScore: totalScoreAccumulated,

                    [courseField]:
                        (data[courseField] || 0) + correctAnswers,

                    averageScore: newAvg,

                    bestScore: newBest,

                    level:
                        Math.floor(totalScoreAccumulated / 100) + 1
                });
            }

        } catch (dbError) {

            console.error(
                "Firestore submission write error:",
                dbError
            );

            alert(
                "Your exam was submitted, but some online statistics " +
                "could not be synchronized. Your local result is saved."
            );
        }

    } else {

        alert(
            "Submitted offline. Please log in to synchronize your score metrics."
        );

        // Local offline history

        try {

            const mockKey = "fundsiq_offline_exam_history_mock";

            let localList = localStorage.getItem(mockKey);

            localList = localList ? JSON.parse(localList) : [];

            localList.unshift({

                id: "offline_" + Date.now(),

                course: selectedCourse,

                score: correctAnswers,

                totalQuestions: totalQuestions,

                percentage: percentage,

                grade:
                    percentage >= 50 ? "A" : "F",

                correct: correctAnswers,

                wrong: wrongAnswers,

                duration: examDuration,

                chapterResults: chapterResults,

                completedAt: new Date().toISOString()
            });

            localStorage.setItem(
                mockKey,
                JSON.stringify(localList)
            );

        } catch (storageError) {

            console.warn(
                "Offline history backup failed:",
                storageError
            );
        }
    }

    // Save exam ID

    try {

        localStorage.setItem("lastExamId", examId);

    } catch (error) {

        console.warn(
            "Failed to store lastExamId:",
            error
        );
    }

    // Go to results

    window.location.href = "result.html";
}

// ==========================================
// GLOBAL FUNCTIONS
// ==========================================

window.startExam = startExam;

window.setMode = setMode;

window.answer = answer;

window.nextQuestion = nextQuestion;

window.prevQuestion = prevQuestion;

window.markForReview = markForReview;

window.finishExam = finishExam;