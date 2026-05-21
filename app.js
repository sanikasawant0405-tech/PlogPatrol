require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const { initializeDatabase, query, execute } = require("./config/db");

const app = express();

const PORT = Number(process.env.PORT || 3456);
const SESSION_SECRET = process.env.SESSION_SECRET || "plogpatrol-dev-session-secret";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const asyncHandler = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};

function wantsJson(req) {
    const acceptHeader = req.get("accept") || "";
    return req.is("application/json") || acceptHeader.includes("application/json");
}

function sendResponse(req, res, { status = 200, message, redirectUrl, data = {} }) {
    if (wantsJson(req)) {
        return res.status(status).json({
            message,
            redirectUrl,
            ...data
        });
    }

    if (redirectUrl) {
        return res.redirect(redirectUrl);
    }

    return res.status(status).send(message || "OK");
}

function getDatabaseErrorMessage(error) {
    if (error?.code === "ER_DATA_TOO_LONG") {
        return "Some entered text is longer than allowed. Please shorten it and try again.";
    }

    if (error?.code === "ER_DUP_ENTRY") {
        return "This record already exists.";
    }

    return null;
}

function formatDateParts(year, month, day) {
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeDate(value) {
    if (!value) {
        return null;
    }

    if (typeof value === "string") {
        const trimmedValue = value.trim();

        if (!trimmedValue) {
            return null;
        }

        const directDateMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

        if (directDateMatch) {
            return `${directDateMatch[1]}-${directDateMatch[2]}-${directDateMatch[3]}`;
        }

        const parsedDate = new Date(trimmedValue);

        if (Number.isNaN(parsedDate.getTime())) {
            return null;
        }

        return formatDateParts(
            parsedDate.getFullYear(),
            parsedDate.getMonth() + 1,
            parsedDate.getDate()
        );
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return formatDateParts(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
    );
}

function getDayName(dateValue) {
    const normalizedDate = normalizeDate(dateValue);

    if (!normalizedDate) {
        return "Unknown";
    }

    return new Date(`${normalizedDate}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long"
    });
}

function serializeRowDates(row) {
    return {
        ...row,
        e_date: normalizeDate(row.e_date) || row.e_date,
        u_dob: normalizeDate(row.u_dob) || row.u_dob,
        d_dob: normalizeDate(row.d_dob) || row.d_dob
    };
}

function serializeDonation(row) {
    let items = [];

    try {
        items = row.items_json ? JSON.parse(row.items_json) : [];
    } catch (error) {
        items = [];
    }

    return {
        ...row,
        amount: row.amount === null ? null : Number(row.amount),
        collection_date: normalizeDate(row.collection_date),
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        items
    };
}

async function getUserByUid(userUid) {
    const [rows] = await query("SELECT * FROM user WHERE u_uid = ?", [userUid]);
    return rows[0] || null;
}

async function getDonorByUserId(donorUserId) {
    const [rows] = await query("SELECT * FROM donorlogin WHERE d_userid = ?", [donorUserId]);
    return rows[0] || null;
}

function eventSelectSql(userUid) {
    if (userUid) {
        return {
            sql: `SELECT e.*,
                         EXISTS(
                            SELECT 1 FROM userevents ue
                            WHERE ue.e_eno = e.e_srno AND ue.u_uname = ?
                         ) AS is_joined
                  FROM eventschedule e`,
            params: [userUid]
        };
    }

    return {
        sql: "SELECT e.*, FALSE AS is_joined FROM eventschedule e",
        params: []
    };
}

async function isPasswordValid(plainPassword, storedPassword) {
    if (!storedPassword) {
        return false;
    }

    if (plainPassword === storedPassword) {
        return true;
    }

    if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$")) {
        return bcrypt.compare(plainPassword, storedPassword);
    }

    return false;
}

function requireUser(req, res, next) {
    if (!req.session.user) {
        return sendResponse(req, res, {
            status: 401,
            message: "Please log in first.",
            redirectUrl: "/UserLogin.html"
        });
    }

    next();
}

function requireDonor(req, res, next) {
    if (!req.session.donor) {
        return sendResponse(req, res, {
            status: 401,
            message: "Please log in as a donor first.",
            redirectUrl: "/Donorlogin.html"
        });
    }

    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.admin) {
        return sendResponse(req, res, {
            status: 401,
            message: "Please log in as admin first.",
            redirectUrl: "/AdminLogin.html"
        });
    }

    next();
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get("/api/session", (req, res) => {
    res.json({
        roles: {
            admin: Boolean(req.session.admin),
            donor: Boolean(req.session.donor),
            user: Boolean(req.session.user)
        }
    });
});

app.post("/UserRegistration", asyncHandler(async (req, res) => {
    const {
        username,
        password,
        confirmPassword,
        securityQuestion,
        Answer
    } = req.body;

    if (!username || !password || !securityQuestion || !Answer) {
        return sendResponse(req, res, {
            status: 400,
            message: "Please fill in all required registration fields."
        });
    }

    if (confirmPassword && password !== confirmPassword) {
        return sendResponse(req, res, {
            status: 400,
            message: "Passwords do not match."
        });
    }

    const [existingUsers] = await query("SELECT u_srno FROM user WHERE u_uid = ?", [username.trim()]);

    if (existingUsers.length > 0) {
        return sendResponse(req, res, {
            status: 409,
            message: "This user ID is already registered."
        });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await execute(
        "INSERT INTO user (u_uid, u_password, u_securityque, u_securityans) VALUES (?, ?, ?, ?)",
        [username.trim(), hashedPassword, securityQuestion, Answer.trim()]
    );

    return sendResponse(req, res, {
        message: "Registration successful.",
        redirectUrl: "/UserLogin.html"
    });
}));

app.post("/UserLogin", asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return sendResponse(req, res, {
            status: 400,
            message: "Username and password are required."
        });
    }

    const user = await getUserByUid(username.trim());

    if (!user) {
        return sendResponse(req, res, {
            status: 401,
            message: "User not found."
        });
    }

    const passwordValid = await isPasswordValid(password, user.u_password);

    if (!passwordValid) {
        return sendResponse(req, res, {
            status: 401,
            message: "Wrong password."
        });
    }

    req.session.user = user.u_uid;

    return sendResponse(req, res, {
        message: "Login successful.",
        redirectUrl: user.has_personal_info ? "/UserMain.html" : "/PersonalInfo.html",
        data: {
            userUid: user.u_uid
        }
    });
}));

/* -------- SUBMIT PERSONAL INFO -------- */
/* -------- SUBMIT PERSONAL INFO -------- */
app.post("/api/submitPersonalInfo", requireUser, asyncHandler(async (req, res) => {

    const {
        u_name,
        u_age,
        u_mobno,
        u_address,
        u_mailid,
        u_gender,
        u_dob
    } = req.body;

    const [result] = await execute(
        `UPDATE user 
         SET u_name=?, 
             u_age=?, 
             u_mobno=?, 
             u_address=?, 
             u_mailid=?, 
             u_gender=?, 
             u_dob=?, 
             has_personal_info = TRUE
         WHERE u_uid=?`,
        [
            u_name?.trim() || null,
            u_age || null,
            u_mobno?.trim() || null,
            u_address?.trim() || null,
            u_mailid?.trim() || null,
            u_gender || null,
            normalizeDate(u_dob),
            req.session.user
        ]
    );

    if (result.affectedRows === 0) {
        return sendResponse(req, res, {
            status: 404,
            message: "User account not found.",
            redirectUrl: "/UserLogin.html"
        });
    }

    return sendResponse(req, res, {
        message: "Personal info saved successfully",
        redirectUrl: "/UserMain.html"
    });
}));

app.get("/display", (req, res) => {
    res.redirect("/UserMain.html");
});

app.get("/UpcomingEvents", asyncHandler(async (req, res) => {
    const eventSelect = eventSelectSql(req.session.user);
    const [rows] = await query(
        `${eventSelect.sql}
         WHERE e.e_date >= CURDATE()
         ORDER BY e.e_date ASC, e.e_time ASC`,
        eventSelect.params
    );

    res.json(rows.map(serializeRowDates));
}));

app.get("/PastEvents", asyncHandler(async (req, res) => {
    const eventSelect = eventSelectSql(req.session.user);
    const [rows] = await query(
        `${eventSelect.sql}
         WHERE e.e_date < CURDATE()
         ORDER BY e.e_date DESC, e.e_time DESC`,
        eventSelect.params
    );

    res.json(rows.map(serializeRowDates));
}));

app.get("/searchEvents", asyncHandler(async (req, res) => {
    const searchTerm = (req.query.query || "").trim();
    const eventSelect = eventSelectSql(req.session.user);

    if (!searchTerm) {
        const [rows] = await query(
            `${eventSelect.sql} ORDER BY e.e_date ASC, e.e_time ASC`,
            eventSelect.params
        );
        return res.json(rows.map(serializeRowDates));
    }

    const wildcardSearch = `%${searchTerm}%`;
    const [rows] = await query(
        `${eventSelect.sql}
         WHERE e.e_name LIKE ? OR e.e_desc LIKE ? OR e.e_loc LIKE ?
         ORDER BY e.e_date ASC, e.e_time ASC`,
        [...eventSelect.params, wildcardSearch, wildcardSearch, wildcardSearch]
    );

    return res.json(rows.map(serializeRowDates));
}));

app.get("/filterEvents", asyncHandler(async (req, res) => {
    const filters = [];
    const params = [];
    const eventSelect = eventSelectSql(req.session.user);

    if (req.query.title) {
        filters.push("e.e_name LIKE ?");
        params.push(`%${req.query.title.trim()}%`);
    }

    if (req.query.location) {
        filters.push("e.e_loc LIKE ?");
        params.push(`%${req.query.location.trim()}%`);
    }

    if (req.query.date) {
        filters.push("e.e_date = ?");
        params.push(normalizeDate(req.query.date));
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const [rows] = await query(
        `${eventSelect.sql} ${whereClause} ORDER BY e.e_date ASC, e.e_time ASC`,
        [...eventSelect.params, ...params]
    );

    res.json(rows.map(serializeRowDates));
}));

async function joinEventHandler(req, res) {
    const userUid = req.session.user;
    const eventId = Number(req.body.eventId || req.body.eid || req.query.eid);

    if (!userUid) {
        return sendResponse(req, res, {
            status: 401,
            message: "Login required to join an event.",
            redirectUrl: "/UserLogin.html"
        });
    }

    if (!eventId) {
        return sendResponse(req, res, {
            status: 400,
            message: "A valid event ID is required."
        });
    }

    const user = await getUserByUid(userUid);

    if (!user) {
        return sendResponse(req, res, {
            status: 404,
            message: "User account not found."
        });
    }

    const [events] = await query("SELECT e_srno FROM eventschedule WHERE e_srno = ?", [eventId]);

    if (events.length === 0) {
        return sendResponse(req, res, {
            status: 404,
            message: "Event not found."
        });
    }

    try {
        await execute(
            "INSERT INTO userevents (e_eno, u_uname) VALUES (?, ?)",
            [eventId, user.u_uid]
        );
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return sendResponse(req, res, {
                message: "You have already joined this event.",
                redirectUrl: "/UserEvents.html"
            });
        }

        throw error;
    }

    return sendResponse(req, res, {
        message: "Event joined successfully.",
        redirectUrl: "/UserEvents.html"
    });
}

app.get("/joinEvent", asyncHandler(joinEventHandler));
app.post("/joinEvent", asyncHandler(joinEventHandler));

app.get("/editUserForm", requireUser, asyncHandler(async (req, res) => {
    const user = await getUserByUid(req.session.user);

    if (!user) {
        return sendResponse(req, res, {
            status: 404,
            message: "User not found.",
            redirectUrl: "/UserLogin.html"
        });
    }

    res.render("editUserForm", {
        user: serializeRowDates(user)
    });
}));

app.post("/editUser", requireUser, asyncHandler(async (req, res) => {
    const {
        u_name,
        u_age,
        u_mobno,
        u_address,
        u_mailid,
        u_gender,
        u_dob
    } = req.body;

    const [result] = await execute(
        `UPDATE user
         SET u_name = ?, u_age = ?, u_mobno = ?, u_address = ?, u_mailid = ?, u_gender = ?, u_dob = ?, has_personal_info = TRUE
         WHERE u_uid = ?`,
        [
            u_name?.trim() || null,
            u_age || null,
            u_mobno?.trim() || null,
            u_address?.trim() || null,
            u_mailid?.trim() || null,
            u_gender || null,
            normalizeDate(u_dob),
            req.session.user
        ]
    );

    if (result.affectedRows === 0) {
        return sendResponse(req, res, {
            status: 404,
            message: "User account not found.",
            redirectUrl: "/UserLogin.html"
        });
    }

    return sendResponse(req, res, {
        message: "Profile updated successfully.",
        redirectUrl: "/UserMain.html"
    });
}));

app.get("/api/user/dashboard", requireUser, asyncHandler(async (req, res) => {
    const user = await getUserByUid(req.session.user);

    if (!user) {
        return res.status(404).json({ message: "User not found." });
    }

    const [joinedCountRows] = await query(
        "SELECT COUNT(*) AS joinedCount FROM userevents WHERE u_uname = ?",
        [req.session.user]
    );
    const [upcomingRows] = await query(
        `SELECT e.*,
                EXISTS(
                    SELECT 1 FROM userevents ue
                    WHERE ue.e_eno = e.e_srno AND ue.u_uname = ?
                ) AS is_joined
         FROM eventschedule e
         WHERE e.e_date >= CURDATE()
         ORDER BY e.e_date ASC, e.e_time ASC
         LIMIT 3`,
        [req.session.user]
    );
    const [joinedRows] = await query(
        `SELECT e.*
         FROM userevents ue
         JOIN eventschedule e ON ue.e_eno = e.e_srno
         WHERE ue.u_uname = ?
         ORDER BY e.e_date DESC, e.e_time DESC
         LIMIT 5`,
        [req.session.user]
    );

    res.json({
        user: serializeRowDates(user),
        joinedCount: joinedCountRows[0]?.joinedCount || 0,
        upcomingEvents: upcomingRows.map(serializeRowDates),
        joinedEvents: joinedRows.map(serializeRowDates)
    });
}));

app.get("/api/currentUser", requireUser, asyncHandler(async (req, res) => {
    const user = await getUserByUid(req.session.user);

    if (!user) {
        return res.status(404).json({ message: "User not found." });
    }

    res.json(serializeRowDates(user));
}));

app.get("/api/getUser/:userUid", requireUser, asyncHandler(async (req, res) => {
    if (req.session.user !== req.params.userUid && !req.session.admin) {
        return res.status(403).json({ message: "You cannot view another user's profile." });
    }

    const user = await getUserByUid(req.params.userUid);

    if (!user) {
        return res.status(404).json({ message: "User not found." });
    }

    res.json(serializeRowDates(user));
}));

app.post("/DonorRegistration", asyncHandler(async (req, res) => {
    const {
        d_userid,
        d_password,
        dconfirmPassword,
        d_securityques,
        d_securityans
    } = req.body;

    if (!d_userid || !d_password || !d_securityques || !d_securityans) {
        return sendResponse(req, res, {
            status: 400,
            message: "Please fill in all required donor registration fields."
        });
    }

    if (dconfirmPassword && d_password !== dconfirmPassword) {
        return sendResponse(req, res, {
            status: 400,
            message: "Passwords do not match."
        });
    }

    const [existingDonors] = await query("SELECT d_srno FROM donorlogin WHERE d_userid = ?", [d_userid.trim()]);

    if (existingDonors.length > 0) {
        return sendResponse(req, res, {
            status: 409,
            message: "This donor user ID is already registered."
        });
    }

    const hashedDonorPassword = await bcrypt.hash(d_password, 10);

    await execute(
        `INSERT INTO donorlogin (d_userid, d_password, d_securityques, d_securityans)
         VALUES (?, ?, ?, ?)`,
        [d_userid.trim(), hashedDonorPassword, d_securityques, d_securityans.trim()]
    );

    return sendResponse(req, res, {
        message: "Donor registration successful.",
        redirectUrl: "/Donorlogin.html"
    });
}));

app.post("/DonorLogin", asyncHandler(async (req, res) => {
    const { d_userid, d_password } = req.body;

    if (!d_userid || !d_password) {
        return sendResponse(req, res, {
            status: 400,
            message: "Username and password are required."
        });
    }

    const donor = await getDonorByUserId(d_userid.trim());

    if (!donor) {
        return sendResponse(req, res, {
            status: 401,
            message: "Invalid donor credentials."
        });
    }

    const passwordValid = await isPasswordValid(d_password, donor.d_password);

    if (!passwordValid) {
        return sendResponse(req, res, {
            status: 401,
            message: "Invalid donor credentials."
        });
    }

    req.session.donor = donor.d_userid;

    return sendResponse(req, res, {
        message: "Donor login successful.",
        redirectUrl: donor.has_personal_info ? "/DonorMain.html" : "/DonorInfo.html"
    });
}));

app.post("/donorPersonalInfo", asyncHandler(async (req, res) => {
    if (!req.session.donor) {
        return sendResponse(req, res, {
            status: 401,
            message: "Please log in as a donor first.",
            redirectUrl: "/Donorlogin.html"
        });
    }

    const {
        d_name,
        d_age,
        d_mobno,
        d_mailid,
        d_gender,
        d_dob
    } = req.body;

    await execute(
        `UPDATE donorlogin
         SET d_name = ?, d_age = ?, d_mobno = ?, d_mailid = ?, d_gender = ?, d_dob = ?, has_personal_info = TRUE
         WHERE d_userid = ?`,
        [
            d_name?.trim() || null,
            d_age || null,
            d_mobno?.trim() || null,
            d_mailid?.trim() || null,
            d_gender || null,
            normalizeDate(d_dob),
            req.session.donor
        ]
    );

    return sendResponse(req, res, {
        message: "Donor personal information saved successfully.",
        redirectUrl: "/DonorMain.html"
    });
}));

app.post("/api/donor/donations", requireDonor, asyncHandler(async (req, res) => {
    const donor = await getDonorByUserId(req.session.donor);

    if (!donor) {
        return sendResponse(req, res, {
            status: 404,
            message: "Donor account not found.",
            redirectUrl: "/Donorlogin.html"
        });
    }

    const donationType = String(req.body.donationType || "").trim().toUpperCase();
    const receiptNo = String(req.body.receiptNo || "").trim();
    const transactionId = String(req.body.transactionId || "").trim() || null;
    const paymentMode = String(req.body.paymentMode || "").trim() || null;
    const status = String(req.body.status || "Submitted").trim();
    const donorName = String(req.body.donorName || donor.d_name || donor.d_userid).trim();
    const donorPhone = String(req.body.donorPhone || donor.d_mobno || "").trim() || null;
    const collectionAddress = String(req.body.collectionAddress || "").trim() || null;
    const collectionDate = normalizeDate(req.body.collectionDate);
    const amount = req.body.amount === null || req.body.amount === undefined || req.body.amount === ""
        ? null
        : Number(req.body.amount);
    const totalQuantity = req.body.totalQuantity === null || req.body.totalQuantity === undefined || req.body.totalQuantity === ""
        ? null
        : Number(req.body.totalQuantity);
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!["UPI", "GOODS"].includes(donationType)) {
        return sendResponse(req, res, {
            status: 400,
            message: "Donation type must be UPI or GOODS."
        });
    }

    if (!receiptNo) {
        return sendResponse(req, res, {
            status: 400,
            message: "Receipt number is required."
        });
    }

    if (donationType === "UPI" && (!Number.isFinite(amount) || amount <= 0)) {
        return sendResponse(req, res, {
            status: 400,
            message: "A valid UPI donation amount is required."
        });
    }

    if (donationType === "GOODS" && items.length === 0) {
        return sendResponse(req, res, {
            status: 400,
            message: "At least one goods donation item is required."
        });
    }

    const normalizedItems = items.map((item) => ({
        name: String(item.name || "").trim(),
        quantity: Math.max(Number(item.quantity) || 1, 1)
    })).filter((item) => item.name);

    if (donationType === "GOODS" && normalizedItems.length === 0) {
        return sendResponse(req, res, {
            status: 400,
            message: "Goods donation items must include item names."
        });
    }

    const [existingRows] = await query(
        "SELECT * FROM donationhistory WHERE receipt_no = ? AND donor_userid = ?",
        [receiptNo, req.session.donor]
    );

    if (existingRows.length > 0) {
        return res.status(200).json({
            message: "Donation already saved.",
            donation: serializeDonation(existingRows[0])
        });
    }

    const [result] = await execute(
        `INSERT INTO donationhistory
         (donor_userid, donor_name, donation_type, receipt_no, transaction_id, amount, payment_mode, status,
          total_quantity, donor_phone, collection_date, collection_address, items_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            req.session.donor,
            donorName || null,
            donationType,
            receiptNo,
            transactionId,
            donationType === "UPI" ? amount : null,
            paymentMode,
            status || "Submitted",
            donationType === "GOODS" ? (Number.isFinite(totalQuantity) ? totalQuantity : normalizedItems.reduce((sum, item) => sum + item.quantity, 0)) : null,
            donorPhone,
            collectionDate,
            collectionAddress,
            donationType === "GOODS" ? JSON.stringify(normalizedItems) : null
        ]
    );

    const [savedRows] = await query("SELECT * FROM donationhistory WHERE donation_id = ?", [result.insertId]);

    return res.status(201).json({
        message: "Donation saved to history.",
        donation: serializeDonation(savedRows[0])
    });
}));

app.get("/api/donor/donations", requireDonor, asyncHandler(async (req, res) => {
    const donor = await getDonorByUserId(req.session.donor);

    if (!donor) {
        return sendResponse(req, res, {
            status: 404,
            message: "Donor account not found.",
            redirectUrl: "/Donorlogin.html"
        });
    }

    const [rows] = await query(
        `SELECT * FROM donationhistory
         WHERE donor_userid = ?
         ORDER BY created_at DESC, donation_id DESC`,
        [donor.d_userid]
    );

    res.json(rows.map(serializeDonation));
}));

app.get("/api/admin/donations", requireAdmin, asyncHandler(async (req, res) => {
    const [rows] = await query(
        `SELECT dh.*, dl.d_mobno AS registered_phone, dl.d_mailid AS registered_email
         FROM donationhistory dh
         LEFT JOIN donorlogin dl ON dh.donor_userid = dl.d_userid
         ORDER BY dh.created_at DESC, dh.donation_id DESC`
    );

    res.json(rows.map(serializeDonation));
}));

app.get("/api/admin/dashboard", requireAdmin, asyncHandler(async (req, res) => {
    const [countRows] = await query(
        `SELECT
            (SELECT COUNT(*) FROM user) AS userCount,
            (SELECT COUNT(*) FROM donorlogin) AS donorCount,
            (SELECT COUNT(*) FROM eventschedule) AS eventCount,
            (SELECT COUNT(*) FROM user WHERE has_personal_info = FALSE) AS pendingUserProfiles,
            (SELECT COUNT(*) FROM donorlogin WHERE has_personal_info = FALSE) AS pendingDonorProfiles`
    );
    const [donationRows] = await query(
        `SELECT
            COUNT(*) AS donationCount,
            COALESCE(SUM(CASE WHEN donation_type = 'UPI' THEN amount ELSE 0 END), 0) AS cashTotal,
            COALESCE(SUM(CASE WHEN donation_type = 'GOODS' THEN total_quantity ELSE 0 END), 0) AS goodsTotal
         FROM donationhistory`
    );
    const [recentEvents] = await query(
        `SELECT * FROM eventschedule
         ORDER BY e_date DESC, e_time DESC
         LIMIT 5`
    );

    res.json({
        counts: countRows[0],
        donations: {
            donationCount: donationRows[0]?.donationCount || 0,
            cashTotal: Number(donationRows[0]?.cashTotal || 0),
            goodsTotal: Number(donationRows[0]?.goodsTotal || 0)
        },
        recentEvents: recentEvents.map(serializeRowDates)
    });
}));


app.post("/AdminMain", asyncHandler(async (req, res) => {
    const { a_id, a_password } = req.body;

    if (a_id === ADMIN_USERNAME && a_password === ADMIN_PASSWORD) {
        req.session.admin = true;
        return sendResponse(req, res, {
            message: "Admin login successful.",
            redirectUrl: "/AdminMain.html"
        });
    }

    return sendResponse(req, res, {
        status: 401,
        message: "Invalid admin credentials."
    });
}));

app.get("/EventDetails", asyncHandler(async (req, res) => {
    const [rows] = await query(
        `SELECT ue.e_eno, u.u_name, u.u_mobno, e.e_name, e.e_date, e.e_day, e.e_time, e.e_loc, e.e_desc
         FROM userevents ue
         JOIN user u ON ue.u_uname = u.u_uid
         JOIN eventschedule e ON ue.e_eno = e.e_srno
         ORDER BY e.e_date DESC, e.e_time DESC`
    );

    res.json(rows.map(serializeRowDates));
}));

app.get("/PloggerDetails", asyncHandler(async (req, res) => {
    const [rows] = await query(
        `SELECT u_srno, u_uid, u_name, u_age, u_mobno, u_address, u_mailid, u_gender, u_dob, has_personal_info
         FROM user
         ORDER BY u_srno DESC`
    );

    res.json(rows.map(serializeRowDates));
}));

app.get("/DonorDetails", asyncHandler(async (req, res) => {
    const [rows] = await query(
        `SELECT d_srno, d_userid, d_name, d_age, d_mobno, d_mailid, d_gender, d_dob, has_personal_info
         FROM donorlogin
         ORDER BY d_srno DESC`
    );

    res.json(rows.map(serializeRowDates));
}));

app.get("/getCounts", asyncHandler(async (req, res) => {
    const [rows] = await query(
        `SELECT
            (SELECT COUNT(*) FROM user) AS userCount,
            (SELECT COUNT(*) FROM donorlogin) AS donorCount,
            (SELECT COUNT(*) FROM eventschedule) AS eventCount`
    );

    res.json(rows[0]);
}));

app.post("/CreateEvent", asyncHandler(async (req, res) => {
    const {
        e_name,
        e_date,
        e_day,
        e_time,
        e_loc,
        e_desc
    } = req.body;

    const normalizedDate = normalizeDate(e_date);

    if (!e_name || !normalizedDate || !e_time || !e_loc || !e_desc) {
        return sendResponse(req, res, {
            status: 400,
            message: "Please fill in all required event fields."
        });
    }

    await execute(
        `INSERT INTO eventschedule (e_name, e_date, e_day, e_time, e_loc, e_desc)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            e_name.trim(),
            normalizedDate,
            e_day?.trim() || getDayName(normalizedDate),
            e_time.trim(),
            e_loc.trim(),
            e_desc.trim()
        ]
    );

    return sendResponse(req, res, {
        message: "Event added successfully.",
        redirectUrl: "/UpcomingEvents.html"
    });
}));

app.delete("/deleteEvent/:id", asyncHandler(async (req, res) => {
    const eventId = Number(req.params.id);

    if (!eventId) {
        return res.status(400).send("Invalid event ID.");
    }

    const [result] = await execute("DELETE FROM eventschedule WHERE e_srno = ?", [eventId]);

    if (result.affectedRows === 0) {
        return res.status(404).send("Event not found.");
    }

    return res.send("Event deleted successfully.");
}));

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/UserLogin.html");
    });
});
app.get("/donorLogout", (req, res) => {
    delete req.session.donor;
    req.session.save(() => {
        res.redirect("/Donorlogin.html");
    });
});

app.get("/adminLogout", (req, res) => {
    delete req.session.admin;
    req.session.save(() => {
        res.redirect("/AdminLogin.html");
    });
});


app.use((err, req, res, next) => {
    console.error("Server error:", err);

    if (res.headersSent) {
        return next(err);
    }

    const friendlyDatabaseMessage = getDatabaseErrorMessage(err);

    if (friendlyDatabaseMessage) {
        if (wantsJson(req)) {
            return res.status(400).json({
                message: friendlyDatabaseMessage
            });
        }

        return res.status(400).send(friendlyDatabaseMessage);
    }

    if (wantsJson(req)) {
        return res.status(500).json({
            message: err.message || "Server error"
        });
    }

    return res.status(500).send(err.message || "Server error");
});

async function startServer() {
    await initializeDatabase();

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer().catch((error) => {
    console.error("Failed to start PlogPatrol.");
    console.error("Make sure MySQL is running and your DB credentials are correct.");
    console.error(error.message);
    process.exit(1);
})
