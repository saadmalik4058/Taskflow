require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/database");

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Fail-fast env validation
// ---------------------------------------------------------------------------
// If any required env var is missing, we exit immediately with a clear
// message instead of crashing later with a cryptic error (e.g. JWT_SECRET
// undefined -> "secretOrPrivateKey must be a string" deep inside jsonwebtoken).
const requiredEnv = [
    "JWT_SECRET",
    "MONGO_URI",
];

const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
    console.error("❌  Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error("\n   Create a .env file or set them in your hosting platform.");
    console.error("   See .env.example for the expected format.");
    process.exit(1);
}

// Warn about weak JWT_SECRET in production
if (process.env.NODE_ENV === "production") {
    const secret = process.env.JWT_SECRET;
    if (secret.length < 32) {
        console.warn(
            "⚠️  JWT_SECRET is shorter than 32 characters. " +
            "Use a 64-char hex string (openssl rand -hex 32)."
        );
    }
    if (secret === "dev-secret-change-in-production") {
        console.error("❌  Using default JWT_SECRET in production. Aborting.");
        process.exit(1);
    }
}

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
};

startServer();