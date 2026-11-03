import pobConfig, { applyTs } from "@pob/eslint-config";
import pobTypescriptReactConfig from "@pob/eslint-config-typescript-react";

const pobConfigs = pobConfig.configs;
const pobTypescriptReactConfigs = pobTypescriptReactConfig.configs;

export default [
  {
    ignores: ["@todo-example/vite/dist"],
  },
  ...pobConfigs.node,
  ...pobConfigs.monorepo,

  ...applyTs({
    mode: "directory",
    files: ["@todo-example/server/src/"],
    configs: [...pobConfigs.node],
  }),

  {
    files: [
      "@todo-example/vite/src/**/*.{ts,tsx}",
      "@todo-example/server/src/**/*.ts",
    ],

    settings: {
      "import/resolver": {
        node: {
          moduleDirectory: ["node_modules", "src"],
        },
      },
    },
  },
  ...applyTs({
    mode: "directory",
    files: ["@todo-example/vite/src/"],
    configs: [
      ...pobTypescriptReactConfigs.base,
      ...pobTypescriptReactConfigs["react-native-web"],
    ],
  }),
  ...applyTs({
    mode: "directory",
    files: [
      "packages/liwi-{mongo,resources,resources-client,resources-direct-client,resources-http-client,resources-http-server,resources-server,resources-void-client,resources-websocket-client,resources-websocket-client-node,resources-websocket-server,store,subscribe-store}/src/",
    ],
    configs: [
      {
        rules: {
          "import-x/no-unresolved": "warn",
        },
      },
    ],
  }),
  ...applyTs({
    mode: "directory",
    files: [
      "packages/{react-liwi,liwi-resources-client,liwi-resources-websocket-client,liwi-resources,liwi-store,liwi-subscribe-store}/src/",
    ],
    configs: [
      ...pobTypescriptReactConfigs.base,
      {
        rules: {
          "import-x/no-unresolved": "warn",
        },
      },
    ],
  }),
  ...applyTs({
    mode: "directory",
    files: ["packages/react-liwi/src/"],
    configs: [...pobTypescriptReactConfigs["react-native-web"]],
  }),
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
