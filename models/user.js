const { execute, query } = require("../config/db");

exports.createUser = async ({ username, password, securityQuestion, answer }) => {
    return execute(
        "INSERT INTO user (u_uid, u_password, u_securityque, u_securityans) VALUES (?, ?, ?, ?)",
        [username, password, securityQuestion, answer]
    );
};

exports.getUserByUid = async (userUid) => {
    const [rows] = await query("SELECT * FROM user WHERE u_uid = ?", [userUid]);
    return rows[0] || null;
};