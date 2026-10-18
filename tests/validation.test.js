const {
    app,
    request,
    authHeader,
    registerAndLogin
} = require("./helpers");

// One standardized failure shape for the whole API:
//   { success: false, message: "...", errors: [{ field, message }] }
// These tests lock that contract down so it cannot drift silently.

describe("Validation and error responses", () => {
    it("returns the standardized shape for a validation failure", async () => {
        const res = await request(app)
            .post("/register")
            .send({ username: "ab", email: "nope", password: "123" });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Validation failed");
        expect(Array.isArray(res.body.errors)).toBe(true);

        const fields = res.body.errors.map((e) => e.field);
        expect(fields).toEqual(expect.arrayContaining(["username", "email", "password"]));

        for (const issue of res.body.errors) {
            expect(typeof issue.field).toBe("string");
            expect(typeof issue.message).toBe("string");
        }
    });

    it("rejects a malformed ObjectId in the params", async () => {
        const { token } = await registerAndLogin();

        const res = await request(app)
            .get("/tasks/not-a-real-id")
            .set(...authHeader(token));

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    field: "id",
                    message: "Must be a valid MongoDB ID"
                })
            ])
        );
    });

    it("rejects a non-numeric page", async () => {
        const { token } = await registerAndLogin();

        const res = await request(app)
            .get("/tasks?page=abc")
            .set(...authHeader(token));

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "page" })])
        );
    });

    it("rejects a limit above the maximum", async () => {
        const { token } = await registerAndLogin();

        const res = await request(app)
            .get("/tasks?limit=500")
            .set(...authHeader(token));

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "limit" })])
        );
    });

    it("rejects an unknown sortBy field", async () => {
        const { token } = await registerAndLogin();

        // A client tries to sort by a field that must never be exposed.
        const res = await request(app)
            .get("/tasks?sortBy=password")
            .set(...authHeader(token));

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "sortBy" })])
        );
    });

    it("rejects an unknown order value", async () => {
        const { token } = await registerAndLogin();

        const res = await request(app)
            .get("/tasks?order=sideways")
            .set(...authHeader(token));

        expect(res.status).toBe(400);
    });

    it("returns 400 for broken JSON instead of an HTML stack trace", async () => {
        const res = await request(app)
            .post("/register")
            .set("Content-Type", "application/json")
            .send('{"username": "broken", ');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            success: false,
            message: "Invalid JSON in request body"
        });
        // The response must be JSON, never an HTML error page.
        expect(res.headers["content-type"]).toMatch(/application\/json/);
    });

    it("returns a JSON 404 for an unknown route", async () => {
        const res = await request(app).get("/this/does/not/exist");

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe("Route GET /this/does/not/exist not found");
    });

    it("does not leak the framework in response headers", async () => {
        const res = await request(app).get("/");

        expect(res.headers["x-powered-by"]).toBeUndefined();
        expect(res.headers["content-security-policy"]).toBeDefined();
    });

    it("still reports the root endpoint", async () => {
        const res = await request(app).get("/");

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("TaskFlow API is running successfully");
    });
});
