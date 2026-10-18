// Runs before every test file and before any application module is
// required, so anything that inspects process.env at load time sees the
// values below.

process.env.NODE_ENV = "test";

// A throwaway secret. Tests must never depend on the developer's real
// .env file, and CI machines will not have one.
process.env.JWT_SECRET = "test-only-secret-do-not-use-in-production";
