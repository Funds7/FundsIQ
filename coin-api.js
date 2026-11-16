import { auth } from "./firebase.js";

const API_URL = "https://fundsiq-api-staging.onrender.com";

export async function getServerCoinBalance() {
    const user = auth.currentUser;
    if (!user) return 0;

    const cacheKey = `fundsiq_coin_balance:${user.uid}`;

    try {
        const token = await user.getIdToken();
        const response = await fetch(`${API_URL}/api/coins/balance`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();

        if (!response.ok || data.success !== true) {
            throw new Error(data.msg || "Unable to load coin balance.");
        }

        const balance = Number(data.balance || 0);
        const safeBalance = Number.isFinite(balance) && balance >= 0 ? balance : 0;
        localStorage.setItem(cacheKey, String(safeBalance));
        return safeBalance;
    } catch (error) {
        // This cached value is display-only. It is never accepted for spending.
        const cached = Number(localStorage.getItem(cacheKey));
        if (Number.isFinite(cached) && cached >= 0) return cached;
        throw error;
    }
}

export async function spendCoinsOnServer(amount, requestReason = "") {
    const user = auth.currentUser;
    if (!user) throw new Error("Please log in to use your coins.");

    const numericAmount = Number(amount);
    if (numericAmount !== 10) {
        throw new Error("This coin purchase is not currently supported.");
    }

    const token = await user.getIdToken();
    const pendingKey = `fundsiq_pending_coin_spend:${user.uid}:exam_attempt`;
    let requestId = sessionStorage.getItem(pendingKey);

    if (!requestId) {
        requestId = globalThis.crypto?.randomUUID
            ? globalThis.crypto.randomUUID()
            : `coin_${user.uid.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem(pendingKey, requestId);
    }

    const response = await fetch(`${API_URL}/api/coins/spend`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            action: "exam_attempt",
            requestId,
            reason: String(requestReason).slice(0, 80)
        })
    });

    const data = await response.json();
    if (!response.ok || data.success !== true) {
        if (response.status === 402) {
            sessionStorage.removeItem(pendingKey);
        }
        const error = new Error(data.msg || "Coin payment failed.");
        error.status = response.status;
        error.balance = data.balance;
        error.required = data.required;
        throw error;
    }

    // Keep the same request ID until a confirmed success, so a retry after a
    // lost response cannot deduct coins twice.
    sessionStorage.removeItem(pendingKey);

    const balance = Number(data.balance || 0);
    if (Number.isFinite(balance) && balance >= 0) {
        localStorage.setItem(`fundsiq_coin_balance:${user.uid}`, String(balance));
    }
    return data;
}
