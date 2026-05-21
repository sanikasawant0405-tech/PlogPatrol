const correctPin = "1515";
const balanceStorageKey = "plogpatrolUpiBalance";
const historyStorageKey = "plogpatrolUpiHistory";
const receiptStorageKey = "plogpatrolLastUpiReceipt";

function readStorageJson(key, fallbackValue) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallbackValue));
    } catch (error) {
        console.warn(`Resetting invalid saved data for ${key}.`, error);
        return fallbackValue;
    }
}

let balance = 0;
let transactionHistory = [];
let lastTransaction = null;

function getActiveDonorId() {
    return localStorage.getItem("donorUserId") || "guest-donor";
}

function getScopedStorageKey(baseKey) {
    return `${baseKey}:${getActiveDonorId()}`;
}

function loadWalletState() {
    balance = Number(localStorage.getItem(getScopedStorageKey(balanceStorageKey)) || 0);
    transactionHistory = readStorageJson(getScopedStorageKey(historyStorageKey), []);
    lastTransaction = readStorageJson(getScopedStorageKey(receiptStorageKey), null);
}

function notify(message, type = "info") {
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }

    window["alert"](message);
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2
    }).format(Number(amount) || 0);
}

function formatDateTime(value) {
    return new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function generateReceiptNumber(prefix) {
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("");
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();

    return `${prefix}-${stamp}-${suffix}`;
}

function getDonorName() {
    return localStorage.getItem("donorUserId") || "Valued Donor";
}

function saveWalletState() {
    localStorage.setItem(getScopedStorageKey(balanceStorageKey), String(balance));
    localStorage.setItem(getScopedStorageKey(historyStorageKey), JSON.stringify(transactionHistory));
    localStorage.setItem(getScopedStorageKey(receiptStorageKey), JSON.stringify(lastTransaction));
}

function updateBalance() {
    const balanceElement = document.getElementById("balance");

    if (balanceElement) {
        balanceElement.textContent = formatCurrency(balance);
    }
}

function readAmount() {
    const amountInput = document.getElementById("amount");
    const amount = Number(amountInput.value);

    if (!Number.isFinite(amount) || amount <= 0) {
        notify("Please enter a valid amount.", "info");
        return null;
    }

    return amount;
}

function recordTransaction(type, amount, status, receiptNo = "-") {
    transactionHistory.unshift({
        type,
        amount,
        status,
        receiptNo,
        date: new Date().toISOString()
    });

    transactionHistory = transactionHistory.slice(0, 10);
    updateTransactionHistory();
}

async function saveDonationToDatabase(receipt) {
    const response = await fetch("/api/donor/donations", {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            donationType: "UPI",
            receiptNo: receipt.receiptNo,
            transactionId: receipt.transactionId,
            donorName: receipt.donorName,
            amount: receipt.amount,
            paymentMode: receipt.paymentMode,
            status: receipt.status
        })
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : { message: await response.text() };

    if (!response.ok) {
        if (data.redirectUrl) {
            window.location.href = data.redirectUrl;
        }

        throw new Error(data.message || "Could not save donation in database.");
    }

    return data.donation;
}

function addMoney() {
    const amount = readAmount();

    if (!amount) {
        return;
    }

    const pin = prompt("Please enter your PIN to confirm:");

    if (pin !== correctPin) {
        notify("Incorrect PIN. Money not added.", "error");
        return;
    }

    balance += amount;
    recordTransaction("Wallet Deposit", amount, "Added");
    saveWalletState();
    updateBalance();
    notify("Money added successfully.", "success");
}

async function makePayment() {
    const amount = readAmount();

    if (!amount) {
        return;
    }

    const pin = prompt("Please enter your PIN to confirm:");

    if (pin !== correctPin) {
        notify("Incorrect PIN. Payment not processed.", "error");
        return;
    }

    if (balance < amount) {
        notify("Insufficient balance.", "error");
        return;
    }

    balance -= amount;

    lastTransaction = {
        receiptNo: generateReceiptNumber("PP-UPI"),
        transactionId: `UPI${Date.now().toString().slice(-8)}`,
        donorName: getDonorName(),
        type: "UPI Payment Donation",
        paymentMode: "UPI Wallet",
        amount,
        balanceAfter: balance,
        status: "Paid",
        savedToDatabase: false,
        date: new Date().toISOString()
    };

    recordTransaction("UPI Donation", -amount, "Paid", lastTransaction.receiptNo);
    saveWalletState();
    updateBalance();
    renderReceipt(lastTransaction);

    try {
        await saveDonationToDatabase(lastTransaction);
        lastTransaction.savedToDatabase = true;
        saveWalletState();
        renderReceipt(lastTransaction);
        notify("Payment successful. Receipt generated and saved in database.", "success");
    } catch (error) {
        console.error(error);
        notify(`Receipt generated, but database save failed: ${error.message}`, "error");
    }
}

function printReceipt() {
    if (!lastTransaction) {
        notify("No payment receipt available. Please make a payment first.", "info");
        return;
    }

    renderReceipt(lastTransaction);
    window.print();
}

function renderReceipt(receipt) {
    const receiptContainer = document.getElementById("receipt-container");

    if (!receiptContainer) {
        return;
    }

    const saveText = receipt.savedToDatabase
        ? "Saved in database"
        : "Generated locally";

    receiptContainer.className = "receipt-card";
    receiptContainer.innerHTML = `
        <div class="receipt-watermark">PP</div>
        <div class="receipt-topline">
            <div>
                <p class="receipt-kicker">PlogPatrol Official Receipt</p>
                <h2>Cash Donation Receipt</h2>
            </div>
            <span class="status-badge">${escapeHtml(receipt.status)}</span>
        </div>

        <div class="receipt-meta">
            <div>
                <span>Receipt No.</span>
                <strong>${escapeHtml(receipt.receiptNo)}</strong>
            </div>
            <div>
                <span>Transaction ID</span>
                <strong>${escapeHtml(receipt.transactionId)}</strong>
            </div>
        </div>

        <div class="receipt-details">
            <p><span>Received From</span><strong>${escapeHtml(receipt.donorName)}</strong></p>
            <p><span>Payment Mode</span><strong>${escapeHtml(receipt.paymentMode)}</strong></p>
            <p><span>Date & Time</span><strong>${formatDateTime(receipt.date)}</strong></p>
            <p><span>History Status</span><strong>${saveText}</strong></p>
        </div>

        <div class="amount-strip">
            <span>Total Donation Amount</span>
            <strong>${formatCurrency(receipt.amount)}</strong>
        </div>

        <div class="receipt-footer-note">
            <strong>Thank you for supporting PlogPatrol.</strong>
            <span>Your contribution helps us organize cleaner, greener community drives.</span>
        </div>

        <button type="button" class="print-inside" onclick="printReceipt()">Print This Receipt</button>
    `;
}

function updateTransactionHistory() {
    const historyContainer = document.getElementById("transaction-history");

    if (!historyContainer) {
        return;
    }

    if (transactionHistory.length === 0) {
        historyContainer.innerHTML = `
            <h2>Transaction History</h2>
            <p>No transactions recorded yet.</p>
        `;
        return;
    }

    const rows = transactionHistory.map((transaction) => `
        <tr>
            <td>${escapeHtml(transaction.type)}</td>
            <td>${formatCurrency(transaction.amount)}</td>
            <td>${escapeHtml(transaction.status)}</td>
            <td>${escapeHtml(transaction.receiptNo)}</td>
            <td>${formatDateTime(transaction.date)}</td>
        </tr>
    `).join("");

    historyContainer.innerHTML = `
        <h2>Transaction History</h2>
        <div class="history-table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Receipt</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

document.addEventListener("DOMContentLoaded", () => {
    loadWalletState();
    updateBalance();
    updateTransactionHistory();

    if (lastTransaction) {
        renderReceipt(lastTransaction);
    }
});
