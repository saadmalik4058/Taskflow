const Task = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/User");

// NOTE: No try/catch here. Express 5 forwards any error thrown in these
// async handlers to src/middleware/errorHandler.js.

// ---------------------------------------------------------------------
// PERMISSION HELPERS
//
// A task has TWO different relationships with users, and they grant
// different rights:
//
//   createdBy  (ownership)      - the task is mine, I may do anything
//   assignedTo (responsibility) - the task was handed to me to carry
//                                 out, so I may read it and move its
//                                 status
//
// They are kept as two separate named checks so that the two ideas do
// not quietly get treated as one.
// ---------------------------------------------------------------------

const isCreator = (task, userId) => task.createdBy.toString() === userId;

const isAssignee = (task, userId) =>
    // assignedTo is optional, so it is often null/undefined. Without this
    // guard, an unassigned task would crash on .toString().
    Boolean(task.assignedTo) && task.assignedTo.toString() === userId;

// Fields that only the task's CREATOR may change. An assignee may move
// the status, because status describes how the work is going. It must not
// be able to rewrite what the work IS, or to reassign the task away.
const CREATOR_ONLY_FIELDS = [
    "title",
    "description",
    "priority",
    "dueDate",
    "assignedTo"
];

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
        scope,
        status,
        priority,
        search,
        page,
        limit,
        sortBy,
        order
    } = req.query;

    // "scope" decides WHICH tasks belong to the caller. There are two
    // honest answers to "show me my tasks":
    //
    //   created  -> the tasks I own (the original behaviour)
    //   assigned -> the tasks I am responsible for, even ones somebody
    //               else created
    //
    // These are separate views rather than filters that stack, because a
    // task I created AND assigned to myself legitimately appears in both.
    // Everything below (status, priority, search, sort, pagination) then
    // narrows whichever set we picked here.
    const filter =
        scope === "assigned"
            ? { assignedTo: req.user.id }
            : { createdBy: req.user.id };

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

    // Either relationship grants read access. Anyone else gets the same
    // 403 as before: they must not be able to tell an existing task from
    // a non-existing one.
    if (!isCreator(task, req.user.id) && !isAssignee(task, req.user.id)) {
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

    const creator = isCreator(task, req.user.id);
    const assignee = isAssignee(task, req.user.id);

    if (!creator && !assignee) {
        return res.status(403).json({
            message: "You are not allowed to update this task"
        });
    }

    // An assignee may ONLY move the status. A creator may change anything.
    //
    // This is deliberately decided BEFORE a single field is written.
    // Checking field by field while updating would let an assignee send
    // {"status": "completed", "title": "mine now"}: the status change
    // would be applied, and only then would the title be refused. The
    // request as a whole must be allowed or refused as a whole.
    //
    // We test each value rather than reading Object.keys(req.body),
    // because that way it does not matter whether the validation layer
    // keeps keys whose value was never supplied.
    if (!creator) {
        const attempted = CREATOR_ONLY_FIELDS.filter(
            (field) => req.body[field] !== undefined
        );

        if (attempted.length > 0) {
            return res.status(403).json({
                message:
                    "You may only update the status of a task assigned to you"
            });
        }
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
