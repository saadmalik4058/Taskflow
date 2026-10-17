// Rate limiting protects the API from abuse.
//
// Without it, an attacker can try thousands of passwords per minute
// against POST /login (a brute-force attack), or flood any endpoint and
// exhaust the server and the database.

const { rateLimit } = require("express-rate-limit");

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
    generalLimiter,
    authLimiter
};
