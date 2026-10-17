// Centralized error handling.
//
// Express decides which middleware to run. If an error-handling
// middleware has FOUR parameters (err, req, res, next), Express uses it
// only when an error occurs somewhere in the chain.
//
// In Express 5, if an async handler throws or its promise rejects, the
// error is forwarded here automatically. That is why we no longer need
// try/catch in every controller (more on that in a later cleanup step).

// Runs for any URL that matched no route.
const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
};

// The final safety net. Express passes any caught error into it.
const errorHandler = (err, req, res, next) => {
    // express.json() (body-parser) rejects broken JSON with this marker.
    // Without this check the client would receive an HTML page with a
    // full stack trace, which leaks server file paths.
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON in request body"
        });
    }

    // body-parser also rejects bodies that are too large (default 100kb).
    if (err.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            message: "Request body is too large"
        });
    }

    // Log the real error for US (server console). Never send it to the
    // client: error messages can expose database and file details.
    console.error(err);

    const status =
        Number.isInteger(err.status) && err.status >= 400 && err.status < 600
            ? err.status
            : 500;

    res.status(status).json({
        success: false,
        message: "Something went wrong on the server"
    });
};

module.exports = {
    notFound,
    errorHandler
};
