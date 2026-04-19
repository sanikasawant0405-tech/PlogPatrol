(function () {
    const siteStylesheetId = "site-stylesheet";

    function ensureSiteStylesheet() {
        if (document.getElementById(siteStylesheetId)) {
            return;
        }

        const link = document.createElement("link");
        link.id = siteStylesheetId;
        link.rel = "stylesheet";
        link.href = "/css/site.css";
        document.head.appendChild(link);
    }

    function Footer(role) {
        const panelLabels = {
            admin: "Admin Workspace",
            donor: "Donor Workspace",
            user: "Community Workspace"
        };

        return `
            <footer>
                <div class="footer-container">
                    <div class="footer-section">
                        <h2>PlogPatrol</h2>
                        <p>${panelLabels[role] || "Community Workspace"} for cleaner routes, stronger participation, and practical environmental action.</p>
                    </div>
                    <div class="footer-section">
                        <h2>Quick Links</h2>
                        <ul>
                            <li><a href="/Loader.html">Home</a></li>
                            <li><a href="/Events.html">Events</a></li>
                            <li><a href="/Gallery.html">Gallery</a></li>
                            <li><a href="/TermsConditions.html">Terms</a></li>
                        </ul>
                    </div>
                    <div class="footer-section">
                        <h2>Accounts</h2>
                        <ul>
                            <li><a href="/UserLogin.html">User Login</a></li>
                            <li><a href="/Donorlogin.html">Donor Login</a></li>
                            <li><a href="/AdminLogin.html">Admin Login</a></li>
                        </ul>
                    </div>
                    <div class="footer-section">
                        <h2>Contact</h2>
                        <p><a href="mailto:contact@plogpatrol.com">contact@plogpatrol.com</a></p>
                        <p>+1-234-567-890</p>
                        <a href="https://www.facebook.com" class="social-media-icon">Facebook</a>
                        <a href="https://www.instagram.com/" class="social-media-icon">Instagram</a>
                    </div>
                </div>
                <div class="footer-bottom">
                    <p>&copy; 2026 PlogPatrol. All rights reserved.</p>
                </div>
            </footer>
        `;
    }

    function AdminFooter() {
        return Footer("admin");
    }

    function DonorFooter() {
        return Footer("donor");
    }

    function UserFooter() {
        return Footer("user");
    }

    const roleFooters = {
        admin: AdminFooter,
        donor: DonorFooter,
        user: UserFooter
    };

    function renderRoleFooters() {
        ensureSiteStylesheet();

        document.querySelectorAll("[data-role-footer]").forEach((target) => {
            const footerFactory = roleFooters[target.dataset.roleFooter];

            if (!footerFactory) {
                return;
            }

            target.outerHTML = footerFactory();
        });
    }

    window.PlogPatrolFooters = {
        AdminFooter,
        DonorFooter,
        UserFooter,
        renderRoleFooters
    };

    renderRoleFooters();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderRoleFooters);
    }
}());
