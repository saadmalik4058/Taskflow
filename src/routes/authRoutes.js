const express = require("express");

const {
    register,
    login,
    getProfile,
    getUsers
} = require("../controllers/authController");

const auth = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiters");
const {
    registerSchema,
    loginSchema
} = require("../validators/authValidators");

const router = express.Router();

router.post("/register", authLimiter, validateBody(registerSchema), register);

router.post("/login", authLimiter, validateBody(loginSchema), login);

router.get("/profile", auth, getProfile);

const authorize = require("../middleware/authorize");

router.get("/users", auth, authorize("admin"), getUsers);

module.exports = router;