const express = require("express");

const {
    register,
    login,
    getProfile,
    getUsers
} = require("../controllers/authController");

const auth = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);

router.post("/login", login);

router.get("/profile", auth, getProfile);

const authorize = require("../middleware/authorize");

router.get("/users", auth, authorize("admin"), getUsers);

module.exports = router;