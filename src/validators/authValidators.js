const { z } = require("zod");
const { email } = require("./common");

// Used by POST /register
const registerSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3, "Username must be at least 3 characters long")
        .max(30, "Username must be at most 30 characters long")
        .regex(
            /^[a-zA-Z0-9_]+$/,
            "Username can only contain letters, numbers and underscores"
        ),

    // The shared email schema trims and lowercases, so "Saad@Gmail.com"
    // and "saad@gmail.com" always mean the same account.
    email,

    // Login is intentionally NOT length checked, so existing accounts
    // with shorter passwords can still sign in.
    password: z
        .string()
        .min(8, "Password must be at least 8 characters long")
        .max(72, "Password must be at most 72 characters long")
});

// Used by POST /login
const loginSchema = z.object({
    email,

    password: z
        .string()
        .min(1, "Password is required")
});

module.exports = {
    registerSchema,
    loginSchema
};
