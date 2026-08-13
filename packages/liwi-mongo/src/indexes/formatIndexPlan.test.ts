import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatIndexPlan, formatIndexPlans } from "./formatIndexPlan.ts";
import type { MongoIndexPlan } from "./types.ts";

const emptyPlan = (collectionName: string): MongoIndexPlan => ({
  collectionName,
  toCreate: [],
  toRecreate: [],
  toCollMod: [],
  toDrop: [],
  unchanged: [],
  undeclaredKept: [],
});

describe("formatIndexPlan", () => {
  it("collapses a plan with nothing to do", () => {
    const plan = { ...emptyPlan("users"), unchanged: ["a_1", "b_1", "c_1"] };

    assert.equal(
      formatIndexPlan(plan),
      "users\n  = 3 unchanged, nothing to do",
    );
  });

  it("lists every action", () => {
    const plan: MongoIndexPlan = {
      ...emptyPlan("tasks"),
      toCreate: [
        {
          name: "completed_1_created_1",
          index: { key: { completed: 1, created: 1 } },
        },
      ],
      toRecreate: [
        {
          name: "label_text",
          index: { key: { label: "text" } },
          existing: { key: { title: "text" }, name: "label_text" },
          differences: [
            {
              field: "key",
              declared: { label: "text" },
              existing: { title: "text" },
            },
          ],
        },
      ],
      toCollMod: [
        {
          name: "sessions_ttl",
          changes: { expireAfterSeconds: 60 },
          differences: [
            { field: "expireAfterSeconds", declared: 60, existing: 3600 },
          ],
        },
      ],
      toDrop: [
        {
          name: "legacy_status_1",
          existing: { key: { status: 1 }, name: "legacy_status_1" },
        },
      ],
      unchanged: ["a_1", "b_1"],
    };

    assert.equal(
      formatIndexPlan(plan),
      [
        "tasks",
        '  + create    completed_1_created_1  {"completed":1,"created":1}',
        '  ~ recreate  label_text             key: {"title":"text"} -> {"label":"text"}',
        "  ! modify    sessions_ttl           expireAfterSeconds: 3600 -> 60",
        "  - drop      legacy_status_1",
        "  = 2 unchanged",
      ].join("\n"),
    );
  });

  it("reports undeclared indexes left in place", () => {
    const plan = {
      ...emptyPlan("tasks"),
      undeclaredKept: ["legacy_status_1"],
    };

    assert.equal(
      formatIndexPlan(plan),
      "tasks\n  ? kept  legacy_status_1  undeclared, not dropped",
    );
  });
});

describe("formatIndexPlans", () => {
  it("joins one block per collection", () => {
    assert.equal(
      formatIndexPlans([emptyPlan("tasks"), emptyPlan("users")]),
      [
        "tasks",
        "  = 0 unchanged, nothing to do",
        "users",
        "  = 0 unchanged, nothing to do",
      ].join("\n"),
    );
  });
});
