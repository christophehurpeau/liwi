import pobConfig, { applyTs } from "@pob/eslint-config";
import pobTypescriptReactConfig from "@pob/eslint-config-typescript-react";

const pobConfigs = pobConfig.configs;
const pobTypescriptReactConfigs = pobTypescriptReactConfig.configs;

export default [
  ...pobConfigs.node,
  ...pobConfigs.monorepo,
  ...["@todo-example/vite/src/", "packages/react-liwi/src/"].flatMap((dir) =>
    applyTs({
      mode: "directory",
      files: [dir],
      configs: [
        ...pobTypescriptReactConfigs.base,
        ...pobTypescriptReactConfigs["react-native-web"],
      ],
    }),
  ),
  {
    files: ["packages/liwi-mongo/package.json"],
    rules: {
      // dev only: mongodb-memory-server-core pins an older mongodb minor
      "check-package-dependencies/no-direct-duplicate-dependencies": [
        "error",
        { onlyWarnsFor: { "mongodb-memory-server-core": ["mongodb"] } },
      ],
    },
  },
];
