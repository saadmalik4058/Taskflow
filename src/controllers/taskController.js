const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");

// NOTE: No try/catch here. Express 5 forwards any error thrown in these
// async handlers to src/middleware/errorHandler.js.

const createTask = async (req, res) => {
    // Zod already guaranteed title, a valid project ID, valid status /
    // priority values and a parseable dueDate.
    const {
        title,
        description,
        status,
        priority,
        dueDate,
        project,
        assignedTo
    } = req.body;

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
};

const getTasks = async (req, res) => {
    // Zod has already validated and cleaned these values: page and limit
    // are real numbers within range, sortBy and order are from the
    // allowed lists, and defaults are filled in. No manual checks needed.
    const {
        status,
        priority,
        search,
        page,
        limit,
        sortBy,
        order
    } = req.query;

    const filter = {
        createdBy: req.user.id
    };

    if (status) {
        filter.status = status;
    }

    if (priority) {
        filter.priority = priority;
    }

    if (search) {
        // Escape regular expression special characters so a search for
        // "c++" or "a.b" is treated as plain text and cannot be used to
        // write a malicious pattern.
        const escapedSearch = search.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        filter.$or = [
            { title: { $regex: escapedSearch, $options: "i" } },
            { description: { $regex: escapedSearch, $options: "i" } }
        ];
    }

    const sortDirection = order === "asc" ? 1 : -1;
    const skip = (page - 1) * limit;

    // Run both queries in parallel instead of waiting for one and then
    // starting the other.
    const [tasks, totalTasks] = await Promise.all([
        Task.find(filter)
            .sort({ [sortBy]: sortDirection, _id: sortDirection })
            .skip(skip)
            .limit(limit),
        Task.countDocuments(filter)
    ]);

    res.status(200).json({
        totalTasks,
        currentPage: page,
        totalPages: Math.ceil(totalTasks / limit),
        pageSize: limit,
        tasks
    });
};

const getTaskById = async (req, res) => {
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
};

const updateTask = async (req, res) => {
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

    // Fields the client did not send are undefined and are skipped, so a
    // partial update only changes what was actually provided.
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
        // null means the client wants to remove the assignment.
        if (assignedTo === null) {
            task.assignedTo = null;
        } else {
            // Same rule as createTask: we do not only check that the
            // ID is valid, we check that the user actually exists.
            const assignedUser = await User.findById(assignedTo);

            if (!assignedUser) {
                return res.status(404).json({
                    message: "Assigned user not found"
                });
            }

            task.assignedTo = assignedTo;
        }
    }

    const updatedTask = await task.save();

    res.status(200).json({
        message: "Task updated successfully",
        task: updatedTask
    });
};

const deleteTask = async (req, res) => {
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
};

module.exports = {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    deleteTask
};
