const { z } = require("zod");
const { mongoId } = require("./common");

// Used by POST /projects
const createProjectSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Project name is required")
        .max(100, "Project name must be at most 100 characters long"),

    description: z
        .string()
        .trim()
        .max(500, "Description must be at most 500 characters long")
        .optional()
});

// Used by PUT /projects/:id
// Every field is optional because a client may update only one field.
const updateProjectSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Project name cannot be empty")
        .max(100, "Project name must be at most 100 characters long")
        .optional(),

    description: z
        .string()
        .trim()
        .max(500, "Description must be at most 500 characters long")
        .optional()
});

// Used for every /projects/:id route
const projectParamsSchema = z.object({
    id: mongoId
});

module.exports = {
    createProjectSchema,
    updateProjectSchema,
    projectParamsSchema
};
