const scope = document.body.dataset.historyScope || "donor";
const endpoint = scope === "admin" ? "/api/admin/donations" : "/api/donor/donations";

const tableBody = document.getElementById("donation-history-body");
const statusElement = document.getElementById("history-status");
const refreshButton = document.getElementById("refresh-history");
const totalDonationsElement = document.getElementById("total-donations");
const totalUpiElement = document.getElementById("total-upi");
const totalGoodsElement = document.getElementById("total-goods");
let currentDonations = [];

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

function formatDate(value) {
    if (!value) {
        return "Not provided";
    }

    return new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatDonationType(type) {
    return type === "UPI" ? "UPI Payment" : "Goods Donation";
}

function notify(message, type = "info") {
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }

    window["alert"](message);
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
    const colspan = 6 + (scope === "admin" ? 1 : 0) + (scope === "donor" ? 1 : 0);
    tableBody.innerHTML = `
        <tr>
            <td colspan="${colspan}" class="empty-state">No donation history found yet.</td>
        </tr>
    `;
}

function sanitizeFileName(value) {
    return String(value || "receipt")
        .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_")
        .replace(/\s+/g, "_");
}

function getDownloadButton(donation) {
    if (scope !== "donor") {
        return "";
    }

    return `
        <td class="receipt-action-cell">
            <button
                type="button"
                class="receipt-download-btn"
                data-donation-id="${Number(donation.donation_id)}"
            >
                Download PDF
            </button>
        </td>
    `;
}

function addPdfLine(doc, label, value, y, maxWidth = 180) {
    doc.setFont("Helvetica", "normal");
    doc.text(`${label}: ${String(value || "-")}`, 14, y, { maxWidth });
}

function downloadDonationReceipt(donation) {
    const jsPdfApi = window.jspdf;

    if (!jsPdfApi || !jsPdfApi.jsPDF) {
        notify("Receipt PDF library could not be loaded.", "error");
        return;
    }

    const { jsPDF } = jsPdfApi;
    const doc = new jsPDF();
    const donorName = donation.donor_name || donation.donor_userid || "Valued Donor";
    const donorPhone = donation.donor_phone || "Not provided";
    let y = 18;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text(
        donation.donation_type === "UPI"
            ? "PlogPatrol Cash Donation Receipt"
            : "PlogPatrol Goods Donation Receipt",
        14,
        y
    );

    y += 12;
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`Receipt No: ${donation.receipt_no || "-"}`, 14, y);
    doc.text(`Status: ${donation.status || "-"}`, 140, y);

    y += 8;
    doc.text(`Generated On: ${formatDateTime(donation.created_at)}`, 14, y);

    y += 12;
    doc.setFont("Helvetica", "bold");
    doc.text("Donor Details", 14, y);

    y += 8;
    addPdfLine(doc, "Name", donorName, y);

    y += 7;
    addPdfLine(doc, "Phone", donorPhone, y);

    if (donation.donation_type === "GOODS") {
        y += 7;
        addPdfLine(doc, "Drop-off / Pickup Date", formatDate(donation.collection_date), y);

        y += 7;
        addPdfLine(doc, "Address", donation.collection_address || "Not provided", y, 180);

        y += 18;
        doc.setFont("Helvetica", "bold");
        doc.text("No.", 14, y);
        doc.text("Item", 30, y);
        doc.text("Qty", 178, y);
        doc.line(14, y + 3, 196, y + 3);

        y += 10;
        doc.setFont("Helvetica", "normal");
        (Array.isArray(donation.items) ? donation.items : []).forEach((item, index) => {
            if (y > 270) {
                doc.addPage();
                y = 18;
            }

            doc.text(String(index + 1), 14, y);
            doc.text(String(item.name || "-"), 30, y, { maxWidth: 135 });
            doc.text(String(item.quantity || 0), 180, y);
            y += 9;
        });

        y += 8;
        doc.setFont("Helvetica", "bold");
        doc.text(`Total Quantity: ${donation.total_quantity || 0}`, 14, y);

        y += 14;
        doc.setTextColor(31, 122, 77);
        doc.text("Thank you for your generous goods donation.", 14, y);
    } else {
        y += 12;
        doc.setFont("Helvetica", "bold");
        doc.text("Payment Details", 14, y);

        y += 8;
        addPdfLine(doc, "Donation Type", formatDonationType(donation.donation_type), y);

        y += 7;
        addPdfLine(doc, "Transaction ID", donation.transaction_id || "-", y);

        y += 7;
        addPdfLine(doc, "Payment Mode", donation.payment_mode || "UPI", y);

        y += 7;
        addPdfLine(doc, "Amount", formatCurrency(donation.amount), y);

        y += 14;
        doc.setFont("Helvetica", "bold");
        doc.text(`Total Donation Amount: ${formatCurrency(donation.amount)}`, 14, y);

        y += 14;
        doc.setTextColor(31, 122, 77);
        doc.text("Thank you for supporting PlogPatrol.", 14, y);
    }

    doc.save(`${sanitizeFileName(donation.receipt_no)}.pdf`);
}

function renderDonations(donations) {
    currentDonations = donations;
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
                ${getDownloadButton(donation)}
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
        currentDonations = [];
        updateSummary([]);
        renderEmptyState();
        statusElement.textContent = error.message || "Error loading donation history.";
    }
}

tableBody.addEventListener("click", (event) => {
    const downloadButton = event.target.closest(".receipt-download-btn");

    if (!downloadButton) {
        return;
    }

    const donationId = Number(downloadButton.getAttribute("data-donation-id"));
    const donation = currentDonations.find((item) => Number(item.donation_id) === donationId);

    if (!donation) {
        notify("Receipt data could not be found for this transaction.", "error");
        return;
    }

    downloadDonationReceipt(donation);
});

refreshButton.addEventListener("click", loadDonationHistory);
loadDonationHistory();
