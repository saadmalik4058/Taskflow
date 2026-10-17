// CORS = Cross-Origin Resource Sharing.
//
// A browser only lets JavaScript on page A read a response from server B
// if server B explicitly says "A is allowed". This is the browser's
// same-origin policy, and CORS is the opt-in exception.
//
// Your future frontend will live on a different origin (for example
// http://localhost:5173 in development or https://taskflow.vercel.app in
// production), so without this the browser would block every request.

const DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
];

// CLIENT_URLS lets deployment configure this without touching code.
// Example: CLIENT_URLS=https://taskflow.vercel.app,https://www.taskflow.com
// Use CLIENT_URLS=* to allow every origin (handy for quick testing only).
const rawOrigins = process.env.CLIENT_URLS;

const allowedOrigins = rawOrigins
    ? rawOrigins
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean)
    : DEFAULT_ORIGINS;

const allowEveryOrigin = allowedOrigins.includes("*");

const corsOptions = {
    origin: (origin, callback) => {
        // Requests from Postman, curl or server-to-server calls have no
        // Origin header. They are not browsers, so CORS does not apply.
        if (!origin) {
            return callback(null, true);
        }

        if (allowEveryOrigin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // callback(null, false) simply omits the CORS headers. The browser
        // then blocks the response on its own. We deliberately do NOT pass
        // an error here, because that would turn into a confusing 500.
        return callback(null, false);
    },

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    // Browsers cache the preflight result, which avoids an extra
    // OPTIONS request on every single API call.
    maxAge: 86400,

    // Authentication uses a Bearer token in the Authorization header,
    // not cookies.  Set this to true only if you later move to cookies.
    credentials: false
};

module.exports = {
    corsOptions,
    allowedOrigins,
    allowEveryOrigin
};
