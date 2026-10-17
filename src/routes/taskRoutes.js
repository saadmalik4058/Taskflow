const express = require("express");

const {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask
} = require("../controllers/taskController");

const auth = require("../middleware/auth");
const { validateBody, validateParams, validateQuery } = require("../middleware/validate");
const {
    createTaskSchema,
    updateTaskSchema,
    listTasksQuerySchema,
    taskParamsSchema
} = require("../validators/taskValidators");

const router = express.Router();

router.post("/tasks", auth, validateBody(createTaskSchema), createTask);
router.get("/tasks", auth, validateQuery(listTasksQuerySchema), getTasks);
router.get("/tasks/:id", auth, validateParams(taskParamsSchema), getTaskById);
router.put("/tasks/:id", auth, validateParams(taskParamsSchema), validateBody(updateTaskSchema), updateTask);
router.delete("/tasks/:id", auth, validateParams(taskParamsSchema), deleteTask);

module.exports = router;