const { z } = require("zod");
const { mongoId, taskStatus, taskPriority } = require("./common");

// Used by POST /tasks
const createTaskSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, "Task title is required")
        .max(200, "Task title must be at most 200 characters long"),

    description: z
        .string()
        .trim()
        .max(2000, "Description must be at most 2000 characters long")
        .optional(),

    status: taskStatus.optional(),

    priority: taskPriority.optional(),

    // z.coerce.date() accepts "2026-01-31" style strings and converts
    // them to a real Date object. An impossible date like "31/13/2026"
    // fails validation with a 400 instead of a MongoDB CastError 500.
    dueDate: z.coerce.date("Due date must be a valid date").optional(),

    project: mongoId,

    assignedTo: mongoId.optional()
});

// Used by PUT /tasks/:id
// assignedTo can be null, which means "remove the assignment".
const updateTaskSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, "Task title cannot be empty")
        .max(200, "Task title must be at most 200 characters long")
        .optional(),

    description: z
        .string()
        .trim()
        .max(2000, "Description must be at most 2000 characters long")
        .optional(),

    status: taskStatus.optional(),

    priority: taskPriority.optional(),

    dueDate: z.coerce.date("Due date must be a valid date").optional(),

    assignedTo: mongoId.nullable().optional()
});

// Used by GET /tasks
// Query values always arrive as strings, so z.coerce.number()
// converts "2" into the number 2 (and rejects "abc").
const listTasksQuerySchema = z.object({
    // Which set of tasks the caller is asking for:
    //   "created"  -> tasks I created (the original behaviour)
    //   "assigned" -> tasks assigned to me, including ones created by
    //                 somebody else
    // These are two separate views, not two filters that stack.
    scope: z.enum(["created", "assigned"]).default("created"),

    status: taskStatus.optional(),

    priority: taskPriority.optional(),

    search: z
        .string()
        .trim()
        .max(200, "Search text must be at most 200 characters long")
        .optional(),

    page: z.coerce
        .number("Page must be a number")
        .int("Page must be a whole number")
        .min(1, "Page must be at least 1")
        .default(1),

    limit: z.coerce
        .number("Limit must be a number")
        .int("Limit must be a whole number")
        .min(1, "Limit must be at least 1")
        .max(100, "Limit must be at most 100")
        .default(10),

    sortBy: z
        .enum(["createdAt", "updatedAt", "title", "dueDate", "priority"])
        .default("createdAt"),

    order: z.enum(["asc", "desc"]).default("desc")
});

// Used for every /tasks/:id route
const taskParamsSchema = z.object({
    id: mongoId
});

module.exports = {
    createTaskSchema,
    updateTaskSchema,
    listTasksQuerySchema,
    taskParamsSchema
};
