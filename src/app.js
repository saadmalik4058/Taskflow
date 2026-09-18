const express = require("express");

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "TaskFlow API is running"
    });
});

app.use(authRoutes);
app.use(projectRoutes);

module.exports = app;