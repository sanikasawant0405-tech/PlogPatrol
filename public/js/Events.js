const eventImages = [
    "images/Image1.jpg",
    "images/Image3.jpg",
    "images/Image6.jpg",
    "images/Image10.jpg",
    "images/Image14.jpg",
    "images/Image18.jpg",
    "images/Image22.jpg",
    "images/Img1.jpg",
    "images/Img4.jpg",
    "images/Img7.jpg"
];

let currentSession = { roles: {} };

document.addEventListener("DOMContentLoaded", async () => {
    const searchButton = document.getElementById("search-button");
    const applyFilterButton = document.getElementById("apply-filter");
    const pagination = document.querySelector(".pagination");

    if (pagination) {
        pagination.hidden = true;
    }

    currentSession = await loadSession();
    fetchAllEvents();

    if (searchButton) {
        searchButton.addEventListener("click", searchEvents);
    }

    if (applyFilterButton) {
        applyFilterButton.addEventListener("click", applyFilters);
    }
});

async function loadSession() {
    try {
        return await fetchJson("/api/session");
    } catch (error) {
        return { roles: {} };
    }
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : { message: await response.text() };

    if (!response.ok) {
        throw new Error(payload.message || "Unable to load events.");
    }

    return payload;
}

function toast(message, type = "info") {
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

function formatEventDate(value) {
    if (!value) {
        return { day: "--", month: "TBA", full: "Date to be announced" };
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return { day: "--", month: "TBA", full: escapeHtml(value) };
    }

    return {
        day: date.toLocaleDateString("en-IN", { day: "2-digit" }),
        month: date.toLocaleDateString("en-IN", { month: "short" }),
        full: date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        })
    };
}

function getEventStatus(eventItem) {
    if (Number(eventItem.is_joined) === 1) {
        return { label: "Joined", className: "joined" };
    }

    const eventDate = new Date(`${eventItem.e_date}T23:59:59`);

    if (!Number.isNaN(eventDate.getTime()) && eventDate < new Date()) {
        return { label: "Past", className: "past" };
    }

    return { label: "Upcoming", className: "upcoming" };
}

function getEventImage(eventItem, index) {
    const numericId = Number(eventItem.e_srno);
    const imageIndex = Number.isFinite(numericId)
        ? numericId % eventImages.length
        : index % eventImages.length;

    return eventImages[imageIndex];
}

function setLoadingState() {
    const eventsList = document.getElementById("events-list");

    if (!eventsList) {
        return;
    }

    eventsList.innerHTML = Array.from({ length: 3 }).map(() => `
        <article class="event event-skeleton" aria-hidden="true">
            <div class="event-skeleton__image"></div>
            <div class="event-details">
                <span></span>
                <strong></strong>
                <p></p>
                <p></p>
            </div>
        </article>
    `).join("");
}

function renderEmptyState() {
    const eventsList = document.getElementById("events-list");

    if (!eventsList) {
        return;
    }

    eventsList.innerHTML = `
        <section class="events-empty">
            <strong>No events found for this filter.</strong>
            <p>Try clearing the search, changing the date, or checking another location.</p>
            <button type="button" id="reset-events">Show All Events</button>
        </section>
    `;

    document.getElementById("reset-events")?.addEventListener("click", () => {
        document.getElementById("search-bar").value = "";
        document.getElementById("filter-title").value = "";
        document.getElementById("filter-location").value = "";
        document.getElementById("filter-date").value = "";
        fetchAllEvents();
    });
}

function buildEventCard(eventItem, index) {
    const eventDate = formatEventDate(eventItem.e_date);
    const status = getEventStatus(eventItem);
    const safeName = escapeHtml(eventItem.e_name);
    const safeLocation = escapeHtml(eventItem.e_loc || "Location to be announced");
    const safeDescription = escapeHtml(eventItem.e_desc || "Details will be shared soon.");
    const safeTime = escapeHtml(eventItem.e_time || "TBA");
    const imagePath = getEventImage(eventItem, index);

    return `
        <article class="event event-card" data-event-id="${eventItem.e_srno}">
            <div class="event-card__media">
                <img src="${imagePath}" alt="${safeName}" class="event-image">
                <span class="event-status event-status--${status.className}">${status.label}</span>
            </div>
            <div class="event-details">
                <div class="event-card__topline">
                    <div class="event-date-pill">
                        <strong>${eventDate.day}</strong>
                        <span>${eventDate.month}</span>
                    </div>
                    <div>
                        <h2>${safeName}</h2>
                        <p class="event-card__full-date">${eventDate.full} at ${safeTime}</p>
                    </div>
                </div>
                <p class="event-card__location"><span>LOC</span>${safeLocation}</p>
                <p class="event-card__description">${safeDescription}</p>
                ${buildEventAction(eventItem, status)}
            </div>
        </article>
    `;
}

function buildEventAction(eventItem, status) {
    if (!currentSession.roles?.user) {
        return '<p class="event-card__hint">Log in as a user to join this event.</p>';
    }

    if (status.className === "past") {
        return '<button class="join-event-btn" type="button" disabled>Event Completed</button>';
    }

    if (status.className === "joined") {
        return '<button class="join-event-btn is-joined" type="button" disabled>Joined</button>';
    }

    return `<button class="join-event-btn" type="button" data-event-id="${eventItem.e_srno}">Join Event</button>`;
}

function displayEvents(eventsData) {
    const eventsList = document.getElementById("events-list");

    if (!eventsList) {
        return;
    }

    if (!Array.isArray(eventsData) || eventsData.length === 0) {
        renderEmptyState();
        return;
    }

    eventsList.innerHTML = eventsData.map(buildEventCard).join("");

    eventsList.querySelectorAll(".join-event-btn[data-event-id]").forEach((button) => {
        button.addEventListener("click", () => joinEvent(button.dataset.eventId));
    });
}

async function fetchAllEvents() {
    setLoadingState();

    try {
        const events = await fetchJson("/searchEvents");
        displayEvents(events);
    } catch (error) {
        console.error("Error fetching events:", error);
        toast(error.message || "Unable to load events.", "error");
        renderEmptyState();
    }
}

async function searchEvents() {
    const searchQuery = document.getElementById("search-bar")?.value.trim() || "";
    setLoadingState();

    try {
        const events = await fetchJson(`/searchEvents?query=${encodeURIComponent(searchQuery)}`);
        displayEvents(events);
    } catch (error) {
        console.error("Search error:", error);
        toast(error.message, "error");
        renderEmptyState();
    }
}

async function applyFilters() {
    const titleFilter = document.getElementById("filter-title")?.value.trim() || "";
    const locationFilter = document.getElementById("filter-location")?.value.trim() || "";
    const dateFilter = document.getElementById("filter-date")?.value || "";
    setLoadingState();

    try {
        const events = await fetchJson(
            `/filterEvents?title=${encodeURIComponent(titleFilter)}&location=${encodeURIComponent(locationFilter)}&date=${encodeURIComponent(dateFilter)}`
        );
        displayEvents(events);
    } catch (error) {
        console.error("Filter error:", error);
        toast(error.message, "error");
        renderEmptyState();
    }
}

async function joinEvent(eventId) {
    try {
        const result = await fetchJson("/joinEvent", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ eventId })
        });

        toast(result.message || "Event joined successfully.", "success");
        fetchAllEvents();
    } catch (error) {
        console.error("Join event error:", error);
        toast(error.message, "error");
    }
}
