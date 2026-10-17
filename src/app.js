const express = require("express");

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
       message: "TaskFlow API is running successfully"
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