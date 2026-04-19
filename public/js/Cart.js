function readStorageJson(key, fallbackValue) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallbackValue));
    } catch (error) {
        console.warn(`Resetting invalid saved data for ${key}.`, error);
        return fallbackValue;
    }
}

let cartItems = readStorageJson("cartItems", []);
let lastGoodsReceipt = readStorageJson("plogpatrolLastGoodsReceipt", null);

const cartItemsContainer = document.getElementById("cart-items");
const totalItemsCountElement = document.getElementById("total-items-count");
const receiptContainer = document.getElementById("receipt-container");

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

function formatDateTime(value) {
    return new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function generateReceiptNumber() {
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("");
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();

    return `PP-GOODS-${stamp}-${suffix}`;
}

function getTotalItems(items = cartItems) {
    return items.reduce((total, item) => total + Math.max(Number(item.quantity) || 0, 0), 0);
}

function updateCartInLocalStorage() {
    localStorage.setItem("cartItems", JSON.stringify(cartItems));
}

function renderCart() {
    cartItemsContainer.innerHTML = "";

    if (cartItems.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-box-open"></i>
                <p>No items in cart.</p>
            </div>
        `;
        totalItemsCountElement.textContent = "0";
        return;
    }

    cartItems.forEach((item, index) => {
        const safeName = escapeHtml(item.name);
        const quantity = Math.max(Number(item.quantity) || 1, 1);
        const itemDiv = document.createElement("div");

        itemDiv.classList.add("cart-item");
        itemDiv.innerHTML = `
            <div class="item-details">
                <span class="item-name">${safeName}</span>
                <label class="item-quantity">
                    Quantity
                    <input type="number" value="${quantity}" min="1" class="quantity-input" data-index="${index}">
                </label>
            </div>
            <button class="delete-btn" data-index="${index}" type="button">
                <i class="fas fa-times"></i> Delete
            </button>
        `;

        cartItemsContainer.appendChild(itemDiv);
    });

    totalItemsCountElement.textContent = String(getTotalItems());
}

function getFormValue(id) {
    const field = document.getElementById(id);
    return field ? field.value.trim() : "";
}

function buildReceipt() {
    const normalizedItems = cartItems.map((item) => ({
        name: String(item.name || "").trim(),
        quantity: Math.max(Number(item.quantity) || 1, 1)
    })).filter((item) => item.name);

    return {
        receiptNo: generateReceiptNumber(),
        donorName: getFormValue("donor-name") || localStorage.getItem("donorUserId") || "Valued Donor",
        donorPhone: getFormValue("donor-phone") || "Not provided",
        collectionDate: getFormValue("donation-date"),
        collectionAddress: getFormValue("donation-address") || "Not provided",
        createdAt: new Date().toISOString(),
        status: "Submitted",
        savedToDatabase: false,
        items: normalizedItems,
        totalQuantity: getTotalItems(normalizedItems)
    };
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
            donationType: "GOODS",
            receiptNo: receipt.receiptNo,
            donorName: receipt.donorName,
            donorPhone: receipt.donorPhone,
            collectionDate: receipt.collectionDate,
            collectionAddress: receipt.collectionAddress,
            totalQuantity: receipt.totalQuantity,
            status: receipt.status,
            items: receipt.items
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

function renderReceipt(receipt) {
    if (!receiptContainer) {
        return;
    }

    const rows = receipt.items.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.name)}</td>
            <td>${item.quantity}</td>
        </tr>
    `).join("");

    const saveText = receipt.savedToDatabase
        ? "Saved in database"
        : "Generated locally";

    receiptContainer.className = "receipt-card";
    receiptContainer.innerHTML = `
        <div class="receipt-watermark">PP</div>
        <div class="receipt-topline">
            <div>
                <p class="receipt-kicker">PlogPatrol Official Receipt</p>
                <h2>Goods Donation Receipt</h2>
            </div>
            <span class="status-badge">${escapeHtml(receipt.status)}</span>
        </div>

        <div class="receipt-meta">
            <div>
                <span>Receipt No.</span>
                <strong>${escapeHtml(receipt.receiptNo)}</strong>
            </div>
            <div>
                <span>Generated On</span>
                <strong>${formatDateTime(receipt.createdAt)}</strong>
            </div>
        </div>

        <div class="receipt-details">
            <p><span>Donor Name</span><strong>${escapeHtml(receipt.donorName)}</strong></p>
            <p><span>Contact Number</span><strong>${escapeHtml(receipt.donorPhone)}</strong></p>
            <p><span>Drop-off / Pickup Date</span><strong>${formatDate(receipt.collectionDate)}</strong></p>
            <p><span>Collection Address</span><strong>${escapeHtml(receipt.collectionAddress)}</strong></p>
            <p><span>History Status</span><strong>${saveText}</strong></p>
        </div>

        <div class="items-card">
            <div class="items-card-header">
                <span>Donated Goods</span>
                <strong>${receipt.totalQuantity} total item(s)</strong>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>No.</th>
                        <th>Item</th>
                        <th>Qty</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

        <div class="receipt-footer-note">
            <strong>Thank you for your generous goods donation.</strong>
            <span>Your support helps PlogPatrol equip volunteers for safer and cleaner drives.</span>
        </div>

        <div class="receipt-actions">
            <button type="button" onclick="printGoodsReceipt()">Print Receipt</button>
            <button type="button" class="outline-action" onclick="downloadGoodsReceipt()">Download PDF</button>
        </div>
    `;
}

async function generateReceipt() {
    if (cartItems.length === 0) {
        notify("Your cart is empty, cannot generate a receipt.", "info");
        return;
    }

    const receipt = buildReceipt();

    if (receipt.items.length === 0) {
        notify("Please select valid goods before generating a receipt.", "info");
        return;
    }

    lastGoodsReceipt = receipt;
    localStorage.setItem("plogpatrolLastGoodsReceipt", JSON.stringify(lastGoodsReceipt));
    renderReceipt(lastGoodsReceipt);
    receiptContainer.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
        await saveDonationToDatabase(lastGoodsReceipt);
        lastGoodsReceipt.savedToDatabase = true;
        localStorage.setItem("plogpatrolLastGoodsReceipt", JSON.stringify(lastGoodsReceipt));
        renderReceipt(lastGoodsReceipt);
        notify("Goods receipt generated and saved in database.", "success");
    } catch (error) {
        console.error(error);
        notify(`Receipt generated, but database save failed: ${error.message}`, "error");
    }
}

function printGoodsReceipt() {
    if (!lastGoodsReceipt) {
        notify("No goods receipt available. Please generate a receipt first.", "info");
        return;
    }

    renderReceipt(lastGoodsReceipt);
    window.print();
}

function downloadGoodsReceipt() {
    if (!lastGoodsReceipt) {
        notify("No goods receipt available. Please generate a receipt first.", "info");
        return;
    }

    const jsPdfApi = window.jspdf;

    if (!jsPdfApi || !jsPdfApi.jsPDF) {
        printGoodsReceipt();
        return;
    }

    const { jsPDF } = jsPdfApi;
    const doc = new jsPDF();
    let y = 18;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text("PlogPatrol Goods Donation Receipt", 14, y);

    y += 12;
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`Receipt No: ${lastGoodsReceipt.receiptNo}`, 14, y);
    doc.text(`Status: ${lastGoodsReceipt.status}`, 140, y);

    y += 8;
    doc.text(`Generated On: ${formatDateTime(lastGoodsReceipt.createdAt)}`, 14, y);

    y += 12;
    doc.setFont("Helvetica", "bold");
    doc.text("Donor Details", 14, y);

    y += 8;
    doc.setFont("Helvetica", "normal");
    doc.text(`Name: ${lastGoodsReceipt.donorName}`, 14, y);

    y += 7;
    doc.text(`Phone: ${lastGoodsReceipt.donorPhone}`, 14, y);

    y += 7;
    doc.text(`Drop-off / Pickup Date: ${formatDate(lastGoodsReceipt.collectionDate)}`, 14, y);

    y += 7;
    doc.text(`Address: ${lastGoodsReceipt.collectionAddress}`, 14, y, { maxWidth: 180 });

    y += 18;
    doc.setFont("Helvetica", "bold");
    doc.text("No.", 14, y);
    doc.text("Item", 30, y);
    doc.text("Qty", 178, y);
    doc.line(14, y + 3, 196, y + 3);

    y += 10;
    doc.setFont("Helvetica", "normal");
    lastGoodsReceipt.items.forEach((item, index) => {
        if (y > 270) {
            doc.addPage();
            y = 18;
        }

        doc.text(String(index + 1), 14, y);
        doc.text(item.name, 30, y, { maxWidth: 135 });
        doc.text(String(item.quantity), 180, y);
        y += 9;
    });

    y += 8;
    doc.setFont("Helvetica", "bold");
    doc.text(`Total Quantity: ${lastGoodsReceipt.totalQuantity}`, 14, y);

    y += 14;
    doc.setTextColor(31, 122, 77);
    doc.text("Thank you for your generous goods donation.", 14, y);
    doc.save(`${lastGoodsReceipt.receiptNo}.pdf`);
}

cartItemsContainer.addEventListener("input", (event) => {
    if (!event.target.classList.contains("quantity-input")) {
        return;
    }

    const index = Number(event.target.getAttribute("data-index"));
    cartItems[index].quantity = Math.max(Number(event.target.value) || 1, 1);
    updateCartInLocalStorage();
    renderCart();
});

cartItemsContainer.addEventListener("click", (event) => {
    const deleteButton = event.target.closest(".delete-btn");

    if (!deleteButton) {
        return;
    }

    const index = Number(deleteButton.getAttribute("data-index"));
    cartItems.splice(index, 1);
    updateCartInLocalStorage();
    renderCart();
});

document.getElementById("clear-cart").addEventListener("click", () => {
    cartItems = [];
    updateCartInLocalStorage();
    renderCart();
});

document.getElementById("edit-cart").addEventListener("click", () => {
    window.location.href = "GoodsCategory.html";
});

document.getElementById("submit-btn").addEventListener("click", generateReceipt);

renderCart();

if (lastGoodsReceipt) {
    renderReceipt(lastGoodsReceipt);
}
