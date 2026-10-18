// Rate limiting protects the API from abuse.
//
// Without it, an attacker can try thousands of passwords per minute
// against POST /login (a brute-force attack), or flood any endpoint and
// exhaust the server and the database.

// ---------------------------------------------------------------------
// Tests must not be throttled by these limiters: a suite that deliberately
// sends dozens of bad requests would trip the 20-attempt auth limit and
// fail for the wrong reason. When NODE_ENV is "test" we swap both
// limiters for a pass-through middleware.
//
// This is the usual way to handle rate limiting in test environments.
// The limiters themselves were verified manually against the running
// server (20 x 401, then 429; successful logins consume no quota).
// ---------------------------------------------------------------------

const { rateLimit } = require("express-rate-limit");

const isTest = process.env.NODE_ENV === "test";

const allowAll = (req, res, next) => next();

// 15 minutes in milliseconds.
const FIFTEEN_MINUTES = 15 * 60 * 1000;

const envNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const windowMs = envNumber(process.env.RATE_LIMIT_WINDOW_MS, FIFTEEN_MINUTES);

// A shared shape so rate-limit responses match the rest of the API.
const tooManyRequests = {
    success: false,
    message: "Too many requests. Please try again later."
};

// Applied to every route. Generous enough for normal use and for your
// Postman testing, but still stops sustained flooding.
const generalLimiter = rateLimit({
    windowMs,
    limit: envNumber(process.env.RATE_LIMIT_MAX, 500),
    standardHeaders: true,
    legacyHeaders: false,
    message: tooManyRequests
});

// Applied only to /register and /login, where guessing is the danger.
// skipSuccessfulRequests means a correct login costs nothing, so real
// users are never locked out by their own normal use. Only failed
// attempts (400 and 401 responses) count toward the limit.
const authLimiter = rateLimit({
    windowMs,
    limit: envNumber(process.env.AUTH_RATE_LIMIT_MAX, 20),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
        success: false,
        message: "Too many attempts. Please try again in a few minutes."
    }
});

module.exports = {
    generalLimiter: isTest ? allowAll : generalLimiter,
    authLimiter: isTest ? allowAll : authLimiter
};
