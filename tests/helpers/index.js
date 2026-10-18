// Shared helpers so each test file stays focused on behaviour instead of
// repeating registration boilerplate.
//
// NOTE: requiring ../src/app gives us the Express app WITHOUT starting a
// listener. That is exactly why src/server.js (listen) and src/app.js
// (build the app) are separate files.

const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/User");

let counter = 0;

// Every test needs a user whose username and email cannot clash with
// another test's, even inside the same file.
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

const makeUserPayload = (overrides = {}) => {
    const suffix = unique();

    return {
        username: `user_${suffix}`,
        email: `user_${suffix}@example.com`,
        password: "password123",
        ...overrides
    };
};

const register = async (overrides = {}) => {
    const payload = makeUserPayload(overrides);
    const res = await request(app).post("/register").send(payload);

    return { payload, res };
};

const registerAndLogin = async (overrides = {}) => {
    const { payload, res } = await register(overrides);

    const login = await request(app).post("/login").send({
        email: payload.email,
        password: payload.password
    });

    return {
        payload,
        userId: res.body.user?.id,
        token: login.body.token
    };
};

// Mirrors the manual mongosh step used earlier: promote an account, then
// log in again. The role lives inside the JWT, so a NEW token is required
// for the new role to take effect.
const registerAsAdmin = async (overrides = {}) => {
    const { payload, userId } = await registerAndLogin(overrides);

    await User.updateOne({ _id: userId }, { role: "admin" });

    const login = await request(app).post("/login").send({
        email: payload.email,
        password: payload.password
    });

    return { payload, userId, token: login.body.token };
};

// SuperTest way to add the bearer header: .set(...authHeader(token))
const authHeader = (token) => ["Authorization", `Bearer ${token}`];

const createProject = (token, overrides = {}) =>
    request(app)
        .post("/projects")
        .set(...authHeader(token))
        .send({ name: "Test Project", description: "A project", ...overrides });

const createTask = (token, projectId, overrides = {}) =>
    request(app)
        .post("/tasks")
        .set(...authHeader(token))
        .send({ title: "Test Task", project: projectId, ...overrides });

module.exports = {
    app,
    request,
    authHeader,
    unique,
    makeUserPayload,
    register,
    registerAndLogin,
    registerAsAdmin,
    createProject,
    createTask
};
