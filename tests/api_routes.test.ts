import { describe, it, expect } from "vitest";
import { GET as getHunts } from "../app/api/v1/hunts/route";
import { GET as getHuntById } from "../app/api/v1/hunts/[id]/route";
import { GET as getHuntLeaderboard } from "../app/api/v1/hunts/[id]/leaderboard/route";
import { GET as getFeatured } from "../app/api/admin/featured/route";
import { POST as postAnswers } from "../app/api/v1/answers/route";

describe("API route error handling", () => {
  it("GET /api/v1/hunts returns paginated hunts with a request id header", async () => {
    const res = await getHunts(new Request("http://localhost/api/v1/hunts?limit=5"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("pagination");
  });

  it("GET /api/admin/featured returns the featured hunt id with a request id header", async () => {
    const res = await getFeatured(new Request("http://localhost/api/admin/featured"), undefined);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("featuredHuntId");
  });

  it("GET /api/v1/hunts/[id] with a non-numeric id returns a consistent { error, code, details } response", async () => {
    const res = await getHuntById(new Request("http://localhost/api/v1/hunts/not-a-number"), {
      params: Promise.resolve({ id: "not-a-number" }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = await res.json();
    expect(body).toEqual({
      error: "Invalid hunt ID",
      code: "VALIDATION_ERROR",
      details: { id: "not-a-number" },
    });
  });

  it("GET /api/v1/hunts/[id] for an unknown hunt returns a 404 NOT_FOUND", async () => {
    const res = await getHuntById(new Request("http://localhost/api/v1/hunts/999999"), {
      params: Promise.resolve({ id: "999999" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(body).toHaveProperty("error");
  });

  it("GET /api/v1/hunts/[id]/leaderboard with an invalid id returns a 400 validation error", async () => {
    const res = await getHuntLeaderboard(new Request("http://localhost/api/v1/hunts/abc/leaderboard"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body).toHaveProperty("error");
  });

  it("POST /api/v1/answers with a missing field returns a 400 validation error naming the field", async () => {
    const res = await postAnswers(
      new Request("http://localhost/api/v1/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ huntId: 1, clueId: 1, answer: "test" }), // wallet omitted
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: "wallet is required",
      code: "VALIDATION_ERROR",
      details: { field: "wallet" },
    });
  });

  it("POST /api/v1/answers with an invalid JSON body returns a 400 validation error", async () => {
    const res = await postAnswers(
      new Request("http://localhost/api/v1/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid request body", code: "VALIDATION_ERROR" });
  });

  it("every error response carries an x-request-id header for tracing", async () => {
    const res = await getHuntById(new Request("http://localhost/api/v1/hunts/not-a-number"), {
      params: Promise.resolve({ id: "not-a-number" }),
    });
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });
});
