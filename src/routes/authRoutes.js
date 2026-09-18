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
router.get("/users", auth, getUsers);

module.exports = router;