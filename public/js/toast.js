(function () {
    const containerId = "plogpatrol-toast-region";
    const originalAlert = window.alert ? window.alert.bind(window) : null;

    function ensureContainer() {
        let container = document.getElementById(containerId);

        if (container) {
            return container;
        }

        container = document.createElement("div");
        container.id = containerId;
        container.className = "pp-toast-region";
        container.setAttribute("aria-live", "polite");
        container.setAttribute("aria-atomic", "true");
        document.body.appendChild(container);

        return container;
    }

    function getType(message, explicitType) {
        if (["success", "error", "info"].includes(explicitType)) {
            return explicitType;
        }

        const text = String(message || "").toLowerCase();

        if (text.includes("failed") || text.includes("error") || text.includes("wrong") || text.includes("invalid") || text.includes("not found") || text.includes("incorrect")) {
            return "error";
        }

        if (text.includes("please") || text.includes("already") || text.includes("required")) {
            return "info";
        }

        return "success";
    }

    function toast(message, options = {}) {
        if (!document.body) {
            if (originalAlert) {
                originalAlert(message);
            }

            return;
        }

        const type = getType(message, options.type);
        const container = ensureContainer();
        const item = document.createElement("div");
        item.className = `pp-toast pp-toast--${type}`;
        item.innerHTML = `
            <span class="pp-toast__mark" aria-hidden="true"></span>
            <span class="pp-toast__message"></span>
            <button class="pp-toast__close" type="button" aria-label="Close notification">Close</button>
        `;

        item.querySelector(".pp-toast__message").textContent = String(message || "Done.");
        item.querySelector(".pp-toast__close").addEventListener("click", () => item.remove());
        container.appendChild(item);

        setTimeout(() => {
            item.classList.add("is-leaving");
            setTimeout(() => item.remove(), 220);
        }, options.duration || 3600);
    }

    window.PlogPatrolToast = {
        show: toast,
        success: (message, options = {}) => toast(message, { ...options, type: "success" }),
        error: (message, options = {}) => toast(message, { ...options, type: "error" }),
        info: (message, options = {}) => toast(message, { ...options, type: "info" })
    };

    window.showToast = (message, type = "info", options = {}) => toast(message, { ...options, type });
    window.alert = (message) => toast(message);
}());
