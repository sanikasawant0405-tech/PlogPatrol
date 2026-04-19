document.addEventListener("DOMContentLoaded", loadDashboard);

async function fetchJson(url) {
    const response = await fetch(url, {
        credentials: "same-origin",
        headers: {
            "Accept": "application/json"
        }
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : { message: await response.text() };

    if (!response.ok) {
        if (payload.redirectUrl) {
            window.location.href = payload.redirectUrl;
        }

        throw new Error(payload.message || "Unable to load dashboard.");
    }

    return payload;
}

function toast(message, type = "info") {
    if (window.showToast) {
        window.showToast(message, type);
    }
}

function formatDate(value) {
    if (!value) {
        return "TBA";
    }

    return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function renderEvents(targetId, events, emptyText) {
    const target = document.getElementById(targetId);

    if (!target) {
        return;
    }

    if (!Array.isArray(events) || events.length === 0) {
        target.innerHTML = `<div class="mini-empty">${emptyText}</div>`;
        return;
    }

    target.innerHTML = events.map((eventItem) => `
        <article class="mini-event">
            <strong>${eventItem.e_name || "Untitled Event"}</strong>
            <span>${formatDate(eventItem.e_date)} at ${eventItem.e_time || "TBA"}</span>
            <span>${eventItem.e_loc || "Location to be announced"}</span>
        </article>
    `).join("");
}

async function loadDashboard() {
    try {
        const dashboard = await fetchJson("/api/user/dashboard");
        const user = dashboard.user || {};
        const displayName = user.u_name || user.u_uid || "Plogger";
        const hasProfile = Boolean(user.has_personal_info);

        document.getElementById("welcome-title").textContent = `Welcome, ${displayName}.`;
        document.getElementById("joined-count").textContent = dashboard.joinedCount || 0;
        document.getElementById("profile-status").textContent = hasProfile ? "Complete" : "Pending";
        document.getElementById("next-step").textContent = hasProfile ? "Join Event" : "Update Profile";

        const reminder = document.getElementById("profile-reminder");
        if (reminder) {
            reminder.hidden = hasProfile;
        }

        renderEvents("upcoming-events", dashboard.upcomingEvents, "No upcoming events available right now.");
        renderEvents("joined-events", dashboard.joinedEvents, "You have not joined any events yet.");
    } catch (error) {
        console.error(error);
        toast(error.message || "Unable to load dashboard.", "error");
    }
}
