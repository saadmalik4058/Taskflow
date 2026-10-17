const bcrypt = require("bcrypt");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

// NOTE: No try/catch here or in any controller.
//
// In Express 5, if an async route handler throws or its promise rejects,
// Express catches the error and forwards it to the centralized error
// handler (src/middleware/errorHandler.js). That handler logs the real
// error on the server and sends the client a safe generic message.
//
// This means each controller only contains its own business logic and
// the intentional responses (201, 200, 400, 403, 404).

const register = async (req, res) => {
    // Zod has already guaranteed that username, email and password exist,
    // are correctly formatted, and that any "role" field was stripped.
    const { username, email, password } = req.body;

    // The unique index alone cannot give a friendly error message, and a
    // plain findOne-then-create has a race condition: two identical
    // requests could both pass this check and one would crash with a
    // duplicate key error. So we keep the check AND catch the database
    // error below as a second line of defense.
    const existingUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existingUser) {
        return res.status(400).json({
            message: "Username or email already exists"
        });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;

    try {
        user = await User.create({
            username,
            email,
            password: hashedPassword
        });
    } catch (error) {
        // 11000 is MongoDB's duplicate key error code. This closes the
        // race window described above.
        if (error.code === 11000) {
            return res.status(400).json({
                message: "Username or email already exists"
            });
        }

        // Anything else is a real server problem: rethrow it and let the
        // error handler deal with it without leaking details.
        throw error;
    }

    res.status(201).json({
        message: "User registered successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        }
    });
};

const login = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    // Same message for both cases on purpose: we must not tell an
    // attacker whether the email exists (otherwise they can enumerate
    // valid accounts).
    if (!user) {
        return res.status(401).json({
            message: "Invalid email or password"
        });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
        return res.status(401).json({
            message: "Invalid email or password"
        });
    }

    const token = generateToken(user);

    res.status(200).json({
        message: "Login successful",
        token
    });
};

const getProfile = async (req, res) => {
    // Unchanged behaviour: the profile is built from the verified token
    // payload. (Loading the user from the database instead would be a
    // nicer feature, but it changes the response shape, so it deserves
    // its own step and your approval.)
    res.status(200).json({
        message: "This is your profile",
        user: req.user
    });
};

const getUsers = async (req, res) => {
    const users = await User.find().select("-password");

    res.status(200).json({
        users
    });
};

module.exports = {
    register,
    login,
    getProfile,
    getUsers
};
