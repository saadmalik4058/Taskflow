const express = require("express");

const {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask
} = require("../controllers/taskController");

const auth = require("../middleware/auth");

const router = express.Router();

router.post("/tasks", auth, createTask);
router.get("/tasks", auth, getTasks);
router.get("/tasks/:id", auth, getTaskById);
router.put("/tasks/:id", auth, updateTask);
router.delete("/tasks/:id", auth, deleteTask);

module.exports = router;