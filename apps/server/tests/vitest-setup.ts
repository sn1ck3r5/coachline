// Runs before any test file imports — populates env that source modules
// validate at import time (each calls process.exit(1) when missing). These
// are placeholders; tests must mock any code path that actually contacts
// AWS, S3, or the queue.
process.env.JWT_SECRET ??= "test-secret-not-for-production-use-only";
process.env.AWS_REGION ??= "us-west-1";
process.env.S3_BUCKET_NAME ??= "test-bucket";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
