(function () {
    function resolveTarget(target) {
        if (typeof target === "string") {
            return document.querySelector(target);
        }

        return target || null;
    }

    function getInsertParent(target) {
        const heading = target.querySelector("h1, h2");

        if (heading) {
            return {
                parent: heading.parentElement,
                before: heading.nextSibling
            };
        }

        return {
            parent: target,
            before: target.firstChild
        };
    }

    function ensureMessage(target) {
        const host = resolveTarget(target);

        if (!host) {
            return null;
        }

        let message = host.querySelector(".form-message-card");

        if (message) {
            return message;
        }

        message = document.createElement("div");
        message.className = "form-message-card";
        message.setAttribute("role", "status");
        message.setAttribute("aria-live", "polite");
        message.innerHTML = `
            <span class="form-message-card__mark" aria-hidden="true"></span>
            <span class="form-message-card__text"></span>
        `;

        const insert = getInsertParent(host);
        insert.parent.insertBefore(message, insert.before);

        return message;
    }

    function showFormMessage(target, messageText, type = "info") {
        const message = ensureMessage(target);

        if (!message) {
            return;
        }

        const safeType = ["success", "error", "info"].includes(type) ? type : "info";
        message.className = `form-message-card form-message-card--${safeType}`;
        message.querySelector(".form-message-card__text").textContent = String(messageText || "");
        message.hidden = false;
    }

    function clearFormMessage(target) {
        const host = resolveTarget(target);
        const message = host?.querySelector(".form-message-card");

        if (message) {
            message.hidden = true;
        }
    }

    window.PlogPatrolFormMessage = {
        show: showFormMessage,
        clear: clearFormMessage
    };

    window.showFormMessage = showFormMessage;
    window.clearFormMessage = clearFormMessage;
}());
