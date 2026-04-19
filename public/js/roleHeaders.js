(function () {
    const stylesheetId = "role-headers-stylesheet";
    const siteStylesheetId = "site-stylesheet";
    const sessionUrl = "/api/session";
    let outsideDropdownHandlerReady = false;

    const adminLinks = [
        { label: "Dashboard", href: "/AdminMain.html", authOnly: true },
        {
            label: "Manage",
            authOnly: true,
            items: [
                { label: "Plogger Details", href: "/PloggerDetails.html" },
                { label: "Donor Details", href: "/DonorDetails.html" },
                { label: "Donation History", href: "/AdminDonationHistory.html" },
                { label: "Event Details", href: "/EventDetail.html" }
            ]
        },
        {
            label: "Events",
            authOnly: true,
            items: [
                { label: "Create Event", href: "/CreateEvent.html" },
                { label: "Upcoming Events", href: "/UpcomingEvents.html" },
                { label: "Past Events", href: "/PastEvents.html" }
            ]
        },
        {
            label: "Gallery",
            items: [
                { label: "View Gallery", href: "/Gallery.html" },
                { label: "Add Image", href: "/AdminAddImage.html", authOnly: true }
            ]
        },
        {
            label: "Account",
            publicOnly: true,
            items: [
                { label: "Admin Login", href: "/AdminLogin.html" },
                { label: "User Login", href: "/UserLogin.html" },
                { label: "Donor Login", href: "/Donorlogin.html" }
            ]
        },
        { label: "Logout", href: "/adminLogout", logout: true }
    ];

    const donorLinks = [
        { label: "Donate", href: "/DonorMain.html", authOnly: true },
        { label: "History", href: "/DonorDonationHistory.html", authOnly: true },
        { label: "Events", href: "/Events.html" },
        { label: "Gallery", href: "/Gallery.html" },
        {
            label: "Account",
            publicOnly: true,
            items: [
                { label: "Admin Login", href: "/AdminLogin.html" },
                { label: "User Login", href: "/UserLogin.html" },
                { label: "Donor Login", href: "/Donorlogin.html" },
                { label: "Donor Registration", href: "/DonorRegistration.html" }
            ]
        },
        { label: "Logout", href: "/donorLogout", authOnly: true, logout: true }
    ];

    const userLinks = [
        { label: "Dashboard", href: "/UserMain.html", authOnly: true },
        { label: "Events", href: "/Events.html" },
        { label: "My Events", href: "/UserEvents.html", authOnly: true },
        { label: "Profile", href: "/editUserForm", authOnly: true },
        { label: "Feedback", href: "/UserReview.html", authOnly: true },
        { label: "Gallery", href: "/Gallery.html" },
        {
            label: "Account",
            publicOnly: true,
            items: [
                { label: "Admin Login", href: "/AdminLogin.html" },
                { label: "User Login", href: "/UserLogin.html" },
                { label: "Donor Login", href: "/Donorlogin.html" },
                { label: "Donor Registration", href: "/DonorRegistration.html" }
            ]
        },
        { label: "Logout", href: "/logout", authOnly: true, logout: true }
    ];

    const roleLinks = {
        admin: adminLinks,
        donor: donorLinks,
        user: userLinks
    };

    function addStylesheet(id, href) {
        if (document.getElementById(id)) {
            return;
        }

        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
    }

    function addScript(id, src) {
        if (document.getElementById(id)) {
            return;
        }

        const script = document.createElement("script");
        script.id = id;
        script.src = src;
        script.defer = true;
        document.head.appendChild(script);
    }

    function ensureStylesheet() {
        addStylesheet(siteStylesheetId, "/css/site.css");
        addStylesheet(stylesheetId, "/css/roleHeaders.css");
        addScript("plogpatrol-toast-script", "/js/toast.js");
    }

    function isActiveLink(href) {
        const currentPath = window.location.pathname.toLowerCase();
        const linkPath = new URL(href, window.location.origin).pathname.toLowerCase();

        return currentPath === linkPath;
    }

    function buildLink(link) {
        const classes = [];
        const attributes = [];

        if (link.authOnly) {
            classes.push("role-header__auth-only");
        }

        if (link.publicOnly) {
            classes.push("role-header__public-only");
        }

        if (link.logout) {
            classes.push("role-header__logout");
            attributes.push("onclick=\"return confirm('Are you sure you want to log out?');\"");
        }

        if (isActiveLink(link.href)) {
            classes.push("is-active");
            attributes.push("aria-current=\"page\"");
        }

        const classAttribute = classes.length ? ` class="${classes.join(" ")}"` : "";

        return `<a href="${link.href}"${classAttribute}${attributes.length ? ` ${attributes.join(" ")}` : ""}>${link.label}</a>`;
    }

    function buildDropdown(dropdown) {
        const classes = ["role-header__dropdown"];

        if (dropdown.publicOnly) {
            classes.push("role-header__public-only");
        }

        if (dropdown.authOnly) {
            classes.push("role-header__auth-only");
        }

        if (dropdown.items.some((item) => isActiveLink(item.href))) {
            classes.push("is-active");
        }

        return `
            <div class="${classes.join(" ")}">
                <button class="role-header__dropdown-button" type="button" aria-expanded="false">
                    ${dropdown.label}
                    <span class="role-header__chevron" aria-hidden="true">&#9662;</span>
                </button>
                <div class="role-header__dropdown-menu">
                    ${dropdown.items.map(buildLink).join("")}
                </div>
            </div>
        `;
    }

    function buildNavItem(item) {
        if (item.items) {
            return buildDropdown(item);
        }

        return buildLink(item);
    }

    function RoleHeader(role, logoutMode) {
        const links = roleLinks[role] || [];

        return `
            <div class="dashboard role-header role-header--${role}" data-role="${role}" data-logout-mode="${logoutMode}">
                <a class="role-header__brand" href="/Loader.html" aria-label="PlogPatrol home">
                    <img src="/images/BLogo.png" alt="PlogPatrol logo" class="logo">
                    <span>
                        <strong>PlogPatrol</strong>
                        <small>Step Up, Clean Up.</small>
                    </span>
                </a>
                <button class="role-header__menu-button" type="button" aria-expanded="false">Menu</button>
                <nav class="nav-links">
                    ${links.map(buildNavItem).join("")}
                </nav>
            </div>
        `;
    }

    function AdminHeader(logoutMode) {
        return RoleHeader("admin", logoutMode);
    }

    function DonorHeader(logoutMode) {
        return RoleHeader("donor", logoutMode);
    }

    function UserHeader(logoutMode) {
        return RoleHeader("user", logoutMode);
    }

    function applySessionState(header, session) {
        const role = header.dataset.role;
        const isAuthenticated = Boolean(session.roles && session.roles[role]);
        const isAnyAuthenticated = Boolean(session.roles && Object.values(session.roles).some(Boolean));

        header.classList.toggle("is-authenticated", isAuthenticated);
        header.classList.toggle("is-any-authenticated", isAnyAuthenticated);
    }

    async function refreshHeaderAuthState() {
        const headers = document.querySelectorAll(".role-header");

        if (!headers.length) {
            return;
        }

        try {
            const response = await fetch(sessionUrl, {
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                return;
            }

            const session = await response.json();
            headers.forEach((header) => applySessionState(header, session));
        } catch (error) {
            headers.forEach((header) => {
                header.classList.remove("is-authenticated");
                header.classList.remove("is-any-authenticated");
            });
        }
    }

    function attachMenuHandlers() {
        document.querySelectorAll(".role-header__menu-button").forEach((button) => {
            if (button.dataset.menuReady === "true") {
                return;
            }

            button.dataset.menuReady = "true";
            button.addEventListener("click", () => {
                const header = button.closest(".role-header");
                const isOpen = header.classList.toggle("is-open");
                button.setAttribute("aria-expanded", String(isOpen));
            });
        });

        document.querySelectorAll(".role-header__dropdown-button").forEach((button) => {
            if (button.dataset.dropdownReady === "true") {
                return;
            }

            button.dataset.dropdownReady = "true";
            button.addEventListener("click", () => {
                const dropdown = button.closest(".role-header__dropdown");
                const isOpen = dropdown.classList.toggle("is-open");
                button.setAttribute("aria-expanded", String(isOpen));
            });
        });

        if (!outsideDropdownHandlerReady) {
            outsideDropdownHandlerReady = true;
            document.addEventListener("click", (event) => {
                if (event.target.closest(".role-header__dropdown")) {
                    return;
                }

                document.querySelectorAll(".role-header__dropdown.is-open").forEach((dropdown) => {
                    dropdown.classList.remove("is-open");
                    const button = dropdown.querySelector(".role-header__dropdown-button");

                    if (button) {
                        button.setAttribute("aria-expanded", "false");
                    }
                });
            });
        }
    }

    function renderRoleHeaders() {
        ensureStylesheet();

        document.querySelectorAll("[data-role-header]").forEach((target) => {
            const role = target.dataset.roleHeader;
            const logoutMode = target.dataset.logoutMode || "auto";
            const factories = {
                admin: AdminHeader,
                donor: DonorHeader,
                user: UserHeader
            };
            const factory = factories[role];

            if (!factory) {
                return;
            }

            target.outerHTML = factory(logoutMode);
        });

        attachMenuHandlers();
        refreshHeaderAuthState();
    }

    window.PlogPatrolHeaders = {
        AdminHeader,
        DonorHeader,
        UserHeader,
        renderRoleHeaders,
        refreshHeaderAuthState
    };

    renderRoleHeaders();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderRoleHeaders);
    }
}());
