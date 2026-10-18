const jwt = require("jsonwebtoken");

const User = require("../src/models/User");
const {
    app,
    request,
    authHeader,
    makeUserPayload,
    register,
    registerAndLogin
} = require("./helpers");

describe("Authentication", () => {
    describe("POST /register", () => {
        it("creates a user and returns it without the password", async () => {
            const { res } = await register();

            expect(res.status).toBe(201);
            expect(res.body.message).toBe("User registered successfully");
            expect(res.body.user).toBeDefined();
            expect(res.body.user.username).toBeDefined();
            expect(res.body.user.email).toBeDefined();
            expect(res.body.user.role).toBe("user");
            expect(res.body.user.password).toBeUndefined();
        });

        it("stores the password as a bcrypt hash, never plain text", async () => {
            const { payload } = await register();

            const saved = await User.findOne({ email: payload.email });

            expect(saved.password).not.toBe(payload.password);
            // bcrypt hashes begin with $2a$ / $2b$ / $2y$ followed by the cost.
            expect(saved.password).toMatch(/^\$2[aby]\$\d{2}\$/);
        });

        it("ignores a role sent by the client (no privilege escalation)", async () => {
            const { res } = await register({ role: "admin" });

            expect(res.status).toBe(201);
            expect(res.body.user.role).toBe("user");

            const saved = await User.findOne({ email: res.body.user.email });
            expect(saved.role).toBe("user");
        });

        it("lowercases and trims the email", async () => {
            const payload = makeUserPayload();
            const res = await request(app)
                .post("/register")
                .send({ ...payload, email: `  ${payload.email.toUpperCase()}  ` });

            expect(res.status).toBe(201);
            expect(res.body.user.email).toBe(payload.email);

            const saved = await User.findOne({ email: payload.email });
            expect(saved).not.toBeNull();
        });

        it("rejects a duplicate username with 400", async () => {
            const { payload } = await register();

            const res = await request(app)
                .post("/register")
                .send({ ...makeUserPayload(), username: payload.username });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe("Username or email already exists");
        });

        it("rejects a duplicate email even when the case differs", async () => {
            const { payload } = await register();

            const res = await request(app)
                .post("/register")
                .send({ ...makeUserPayload(), email: payload.email.toUpperCase() });

            expect(res.status).toBe(400);
        });

        it("rejects a password shorter than 8 characters", async () => {
            const { res } = await register({ password: "123456" });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: "password" })
                ])
            );
        });

        it("rejects an invalid email address", async () => {
            const { res } = await register({ email: "not-an-email" });

            expect(res.status).toBe(400);
            expect(res.body.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: "email" })
                ])
            );
        });

        it("rejects a missing body entirely", async () => {
            const res = await request(app).post("/register").send({});

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.errors.length).toBeGreaterThan(0);
        });
    });

    describe("POST /login", () => {
        it("returns a token for valid credentials", async () => {
            const { payload } = await register();

            const res = await request(app)
                .post("/login")
                .send({ email: payload.email, password: payload.password });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Login successful");
            expect(typeof res.body.token).toBe("string");
            expect(res.body.token.split(".")).toHaveLength(3); // header.payload.signature
        });

        it("accepts the email in a different case", async () => {
            const { payload } = await register();

            const res = await request(app)
                .post("/login")
                .send({
                    email: payload.email.toUpperCase(),
                    password: payload.password
                });

            expect(res.status).toBe(200);
        });

        it("rejects a wrong password with 401", async () => {
            const { payload } = await register();

            const res = await request(app)
                .post("/login")
                .send({ email: payload.email, password: "wrongpassword" });

            expect(res.status).toBe(401);
            expect(res.body.message).toBe("Invalid email or password");
        });

        it("gives the same message for an unknown email (no account enumeration)", async () => {
            const unknown = await request(app)
                .post("/login")
                .send({ email: "ghost@example.com", password: "password123" });

            const { payload } = await register();
            const wrongPassword = await request(app)
                .post("/login")
                .send({ email: payload.email, password: "wrongpassword" });

            expect(unknown.status).toBe(401);
            expect(unknown.body.message).toBe(wrongPassword.body.message);
        });

        it("never puts the password or hash in the token", async () => {
            const { payload, token } = await registerAndLogin();

            const decoded = jwt.decode(token);

            expect(decoded.password).toBeUndefined();
            expect(decoded.role).toBe("user");
            expect(JSON.stringify(decoded)).not.toContain(payload.password);
        });
    });

    describe("GET /profile", () => {
        it("returns the profile for a valid token", async () => {
            const { token, payload } = await registerAndLogin();

            const res = await request(app)
                .get("/profile")
                .set(...authHeader(token));

            expect(res.status).toBe(200);
            expect(res.body.user.username).toBe(payload.username);
        });

        it("rejects a request with no token", async () => {
            const res = await request(app).get("/profile");

            expect(res.status).toBe(401);
            expect(res.body.message).toBe("Authorization token required");
        });

        it("rejects a malformed Authorization header", async () => {
            const res = await request(app)
                .get("/profile")
                .set("Authorization", "NotBearer sometoken");

            expect(res.status).toBe(401);
        });

        it("rejects a tampered token", async () => {
            const { token } = await registerAndLogin();

            const res = await request(app)
                .get("/profile")
                .set(...authHeader(`${token}x`));

            expect(res.status).toBe(401);
            expect(res.body.message).toBe("Invalid or expired token");
        });

        it("rejects an expired token", async () => {
            const { userId } = await registerAndLogin();

            const expired = jwt.sign(
                { id: userId, username: "someone", role: "user" },
                process.env.JWT_SECRET,
                { expiresIn: "-1s" }
            );

            const res = await request(app)
                .get("/profile")
                .set(...authHeader(expired));

            expect(res.status).toBe(401);
        });

        it("rejects a token signed with the wrong secret", async () => {
            const { userId } = await registerAndLogin();

            const forged = jwt.sign(
                { id: userId, username: "hacker", role: "admin" },
                "a-completely-different-secret",
                { expiresIn: "1h" }
            );

            const res = await request(app)
                .get("/profile")
                .set(...authHeader(forged));

            expect(res.status).toBe(401);
        });
    });
});
