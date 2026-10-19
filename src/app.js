const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { generalLimiter } = require("./middleware/rateLimiters");
const { corsOptions } = require("./config/cors");

const app = express();

// Helmet adds a set of protective response headers and removes the
// "X-Powered-By: Express" header, so attackers cannot fingerprint the
// framework and browser protections are enabled by default.
//
// crossOriginResourcePolicy is relaxed to "cross-origin" because this is
// an API: the future frontend on another origin must be able to read
// responses. The default ("same-origin") would block that in some browsers.
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    })
);

// Must run before the routes so preflight OPTIONS requests are answered
// and every response carries the correct CORS headers.
app.use(cors(corsOptions));

app.use(express.json());

// One shared limit across all routes, on top of the stricter limit that
// /register and /login apply individually.
app.use(generalLimiter);

app.get("/", (req, res) => {
    res.json({
       message: "TaskFlow API is running successfully"
    });
});

// Health check endpoint for load balancers, Docker, and hosting platforms.
// Returns 200 if the process is up. Does NOT check DB — that's a separate
// "readiness" check. Keeping it simple: if Node is running, the API can
// receive requests (DB errors will surface on actual routes).
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        env: process.env.NODE_ENV || "development"
    });
});

app.use(authRoutes);
app.use(projectRoutes);

app.use(taskRoutes);

// Order matters: the 404 handler must come AFTER all routes so it only
// catches URLs that no route matched, and the error handler must come
// last so it can catch anything the earlier layers throw.
app.use(notFound);
app.use(errorHandler);

module.exports = app;