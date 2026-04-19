const bcrypt = require("bcryptjs");
const userModel = require("../models/user");

exports.registerUser = async (req, res) => {
    try {
        const {
            username,
            password,
            securityQuestion,
            Answer
        } = req.body;

        if (!username || !password || !securityQuestion || !Answer) {
            return res.status(400).json({
                message: "username, password, securityQuestion, and Answer are required."
            });
        }

        const existingUser = await userModel.getUserByUid(username.trim());

        if (existingUser) {
            return res.status(409).json({
                message: "This user ID is already registered."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await userModel.createUser({
            username: username.trim(),
            password: hashedPassword,
            securityQuestion,
            answer: Answer.trim()
        });

        return res.status(201).json({
            message: "User registered successfully."
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || "Unable to register user."
        });
    }
};