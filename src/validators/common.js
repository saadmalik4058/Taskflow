const { z } = require("zod");

// Shared building blocks used by more than one validator file.
// Keeping them here avoids copying the same regex into three places.

const mongoId = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Must be a valid MongoDB ID");

// Order matters here. z.email() checks the format of whatever string it
// receives, so if we trimmed AFTER the check, " saad@x.com " would be
// rejected. Chaining .trim().toLowerCase() first and then .pipe(z.email())
// means we clean the input, then validate the cleaned value.
const email = z
    .string("Email is required")
    .trim()
    .toLowerCase()
    .pipe(
        z
            .email("Please provide a valid email address")
            .max(100, "Email must be at most 100 characters long")
    );

const taskStatus = z.enum(["pending", "in-progress", "completed"]);

const taskPriority = z.enum(["low", "medium", "high"]);

module.exports = {
    mongoId,
    email,
    taskStatus,
    taskPriority
};
