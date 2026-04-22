import { describe, it, expect } from "vitest";
import { CreateRecordingSchema, CreateGoalSchema, UpdateGoalSchema, UpdateUserSchema } from "../src";

describe("CreateRecordingSchema", () => {
  it("accepts valid recording input", () => {
    const result = CreateRecordingSchema.safeParse({
      audioUrl: "recordings/abc-123/audio.m4a",
      durationSeconds: 2700,
      fileSizeBytes: 45000000,
      title: "Period 3 Biology",
    });
    expect(result.success).toBe(true);
  });

  it("rejects recording over 90 minutes", () => {
    const result = CreateRecordingSchema.safeParse({
      audioUrl: "recordings/abc-123/audio.m4a",
      durationSeconds: 5401,
      fileSizeBytes: 45000000,
    });
    expect(result.success).toBe(false);
  });

  it("allows empty title", () => {
    const result = CreateRecordingSchema.safeParse({
      audioUrl: "recordings/abc-123/audio.m4a",
      durationSeconds: 1800,
      fileSizeBytes: 30000000,
    });
    expect(result.success).toBe(true);
  });
});

describe("CreateGoalSchema", () => {
  it("accepts valid goal with preset practice area", () => {
    const result = CreateGoalSchema.safeParse({
      practiceArea: "wait_time",
      targetMetric: "3+ seconds average wait time",
    });
    expect(result.success).toBe(true);
  });

  it("requires customLabel for custom practice area", () => {
    const result = CreateGoalSchema.safeParse({
      practiceArea: "custom",
      targetMetric: "my target",
    });
    expect(result.success).toBe(false);
  });

  it("accepts custom goal with label", () => {
    const result = CreateGoalSchema.safeParse({
      practiceArea: "custom",
      targetMetric: "50% student talk",
      customLabel: "More student voice in discussions",
    });
    expect(result.success).toBe(true);
  });
});

describe("UpdateGoalSchema", () => {
  it("accepts status update", () => {
    const result = UpdateGoalSchema.safeParse({ status: "completed" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = UpdateGoalSchema.safeParse({ status: "deleted" });
    expect(result.success).toBe(false);
  });
});

describe("UpdateUserSchema", () => {
  it("accepts name update", () => {
    const result = UpdateUserSchema.safeParse({ name: "Ms. Rodriguez" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = UpdateUserSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
