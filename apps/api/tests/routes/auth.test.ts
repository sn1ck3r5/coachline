import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../setup";
import type { FastifyInstance } from "fastify";

describe("Auth routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it("rejects unauthenticated requests to protected routes", async () => {
    const response = await app.inject({ method: "GET", url: "/recordings" });
    expect(response.statusCode).toBe(401);
  });

  it("health check returns 200", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
  });
});
