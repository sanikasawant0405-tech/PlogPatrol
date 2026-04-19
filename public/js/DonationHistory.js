const scope = document.body.dataset.historyScope || "donor";
const endpoint = scope === "admin" ? "/api/admin/donations" : "/api/donor/donations";

const tableBody = document.getElementById("donation-history-body");
const statusElement = document.getElementById("history-status");
const refreshButton = document.getElementById("refresh-history");
const totalDonationsElement = document.getElementById("total-donations");
const totalUpiElement = document.getElementById("total-upi");
const totalGoodsElement = document.getElementById("total-goods");

function escapeHtml(value) {
    return String(value ?? "")
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
    if (!value) {
        return "-";
    }

    return new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatDonationType(type) {
    return type === "UPI" ? "UPI Payment" : "Goods Donation";
}

function getItemsText(donation) {
    if (!Array.isArray(donation.items) || donation.items.length === 0) {
        return "-";
    }

    return donation.items
        .map((item) => `${item.name} x ${item.quantity}`)
        .join(", ");
}

function getAmountOrGoods(donation) {
    if (donation.donation_type === "UPI") {
        return formatCurrency(donation.amount);
    }

    return `${donation.total_quantity || 0} item(s)`;
}

function getDetails(donation) {
    if (donation.donation_type === "UPI") {
        return `Txn: ${donation.transaction_id || "-"}`;
    }

    const date = donation.collection_date || "Not provided";
    const address = donation.collection_address || "Not provided";
    return `Items: ${getItemsText(donation)} | Date: ${date} | Address: ${address}`;
}

function updateSummary(donations) {
    const totalUpi = donations
        .filter((donation) => donation.donation_type === "UPI")
        .reduce((sum, donation) => sum + (Number(donation.amount) || 0), 0);

    const totalGoods = donations
        .filter((donation) => donation.donation_type === "GOODS")
        .reduce((sum, donation) => sum + (Number(donation.total_quantity) || 0), 0);

    totalDonationsElement.textContent = String(donations.length);
    totalUpiElement.textContent = formatCurrency(totalUpi);
    totalGoodsElement.textContent = String(totalGoods);
}

function renderEmptyState() {
    const colspan = scope === "admin" ? 7 : 6;
    tableBody.innerHTML = `
        <tr>
            <td colspan="${colspan}" class="empty-state">No donation history found yet.</td>
        </tr>
    `;
}

function renderDonations(donations) {
    updateSummary(donations);

    if (donations.length === 0) {
        renderEmptyState();
        statusElement.textContent = "No donations saved yet.";
        return;
    }

    const rows = donations.map((donation) => {
        const donorCell = scope === "admin"
            ? `<td><strong>${escapeHtml(donation.donor_name || donation.donor_userid)}</strong><span>${escapeHtml(donation.donor_userid)}</span></td>`
            : "";

        return `
            <tr>
                ${donorCell}
                <td><strong>${escapeHtml(donation.receipt_no)}</strong></td>
                <td><span class="type-pill ${donation.donation_type === "UPI" ? "upi" : "goods"}">${formatDonationType(donation.donation_type)}</span></td>
                <td>${escapeHtml(getAmountOrGoods(donation))}</td>
                <td><span class="status-pill">${escapeHtml(donation.status)}</span></td>
                <td>${formatDateTime(donation.created_at)}</td>
                <td class="details-cell" title="${escapeHtml(getDetails(donation))}">${escapeHtml(getDetails(donation))}</td>
            </tr>
        `;
    }).join("");

    tableBody.innerHTML = rows;
    statusElement.textContent = `${donations.length} record(s) loaded from database.`;
}

async function loadDonationHistory() {
    statusElement.textContent = "Loading donation history...";
    tableBody.innerHTML = "";

    try {
        const response = await fetch(endpoint, {
            credentials: "same-origin",
            headers: {
                "Accept": "application/json"
            }
        });
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await response.json()
            : { message: await response.text() };

        if (!response.ok) {
            if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
                return;
            }

            throw new Error(data.message || "Could not load donation history.");
        }

        renderDonations(Array.isArray(data) ? data : []);
    } catch (error) {
        console.error(error);
        updateSummary([]);
        renderEmptyState();
        statusElement.textContent = error.message || "Error loading donation history.";
    }
}

refreshButton.addEventListener("click", loadDonationHistory);
loadDonationHistory();
