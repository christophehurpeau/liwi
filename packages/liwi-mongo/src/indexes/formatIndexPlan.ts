import type { MongoIndexDifference, MongoIndexPlan } from "./types.ts";

const formatDifference = ({
  field,
  declared,
  existing,
}: MongoIndexDifference): string =>
  `${field}: ${JSON.stringify(existing) ?? "undefined"} -> ${JSON.stringify(declared) ?? "undefined"}`;

const formatDifferences = (
  differences: readonly MongoIndexDifference[],
): string =>
  differences.map((difference) => formatDifference(difference)).join(", ");

interface PlanLine {
  action: string;
  name: string;
  detail: string;
}

const buildLines = (plan: MongoIndexPlan): PlanLine[] => [
  ...plan.toCreate.map(({ name, index }) => ({
    action: "+ create",
    name,
    detail: JSON.stringify(index.key),
  })),
  ...plan.toRecreate.map(({ name, differences }) => ({
    action: "~ recreate",
    name,
    detail: formatDifferences(differences),
  })),
  ...plan.toCollMod.map(({ name, differences }) => ({
    action: "! modify",
    name,
    detail: formatDifferences(differences),
  })),
  ...plan.toDrop.map(({ name }) => ({ action: "- drop", name, detail: "" })),
  ...plan.undeclaredKept.map((name) => ({
    action: "? kept",
    name,
    detail: "undeclared, not dropped",
  })),
];

export const formatIndexPlan = (plan: MongoIndexPlan): string => {
  const lines = buildLines(plan);
  const unchangedCount = plan.unchanged.length;

  if (lines.length === 0) {
    return `${plan.collectionName}\n  = ${unchangedCount} unchanged, nothing to do`;
  }

  const actionWidth = Math.max(...lines.map(({ action }) => action.length));
  const nameWidth = Math.max(...lines.map(({ name }) => name.length));

  const formattedLines = lines.map(
    ({ action, name, detail }) =>
      `  ${action.padEnd(actionWidth)}  ${detail ? name.padEnd(nameWidth) : name}${detail ? `  ${detail}` : ""}`,
  );

  if (unchangedCount > 0) {
    formattedLines.push(`  = ${unchangedCount} unchanged`);
  }

  return [plan.collectionName, ...formattedLines].join("\n");
};

export const formatIndexPlans = (plans: readonly MongoIndexPlan[]): string =>
  plans.map((plan) => formatIndexPlan(plan)).join("\n");

export { isMongoIndexPlanEmpty } from "./diffIndexes.ts";
