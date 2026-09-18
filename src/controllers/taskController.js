const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");

const createTask = async (req, res) => {
    try {
        const {
            title,
            description,
            status,
            priority,
            dueDate,
            project,
            assignedTo
        } = req.body;

        if (!title || !project) {
            return res.status(400).json({
                message: "Task title and project are required"
            });
        }

        const existingProject = await Project.findById(project);

        if (!existingProject) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        if (existingProject.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                message: "You are not allowed to add tasks to this project"
            });
        }

        if (assignedTo) {
    const assignedUser = await User.findById(assignedTo);

    if (!assignedUser) {
        return res.status(404).json({
            message: "Assigned user not found"
        });
    }
}

        const task = await Task.create({
            title,
            description,
            status,
            priority,
            dueDate,
            project,
            createdBy: req.user.id,
            assignedTo
        });

        res.status(201).json({
            message: "Task created successfully",
            task
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to create task",
            error: error.message
        });
    }
};

const getTasks = async (req, res) => {
    try {
        const { status, priority } = req.query;

        const filter = {
            createdBy: req.user.id
        };

        if (status) {
            filter.status = status;
        }

        if (priority) {
            filter.priority = priority;
        }

        const tasks = await Task.find(filter);

        res.status(200).json({
            tasks
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to get tasks",
            error: error.message
        });
    }
};

const getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        if (task.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                message: "You are not allowed to view this task"
            });
        }

        res.status(200).json({
            task
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to get task",
            error: error.message
        });
    }
};

const updateTask = async (req, res) => {
    try {
        const {
            title,
            description,
            status,
            priority,
            dueDate,
            assignedTo
        } = req.body;

        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        if (task.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                message: "You are not allowed to update this task"
            });
        }

        if (title !== undefined) {
            task.title = title;
        }

        if (description !== undefined) {
            task.description = description;
        }

        if (status !== undefined) {
            task.status = status;
        }

        if (priority !== undefined) {
            task.priority = priority;
        }

        if (dueDate !== undefined) {
            task.dueDate = dueDate;
        }

        if (assignedTo !== undefined) {
            task.assignedTo = assignedTo;
        }

        const updatedTask = await task.save();

        res.status(200).json({
            message: "Task updated successfully",
            task: updatedTask
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to update task",
            error: error.message
        });
    }
};

const deleteTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({
                message: "Task not found"
            });
        }

        if (task.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                message: "You are not allowed to delete this task"
            });
        }

        await Task.findByIdAndDelete(req.params.id);

        res.status(200).json({
            message: "Task deleted successfully",
            task
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to delete task",
            error: error.message
        });
    }
};

module.exports = {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask
};