import pobConfig, { applyTs } from "@pob/eslint-config";
import pobTypescriptReactConfig from "@pob/eslint-config-typescript-react";

const pobConfigs = pobConfig.configs;
const pobTypescriptReactConfigs = pobTypescriptReactConfig.configs;

const warnUnsafeConfig = {
  rules: {
    "@typescript-eslint/no-unsafe-argument": "warn",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-return": "warn",
    "@typescript-eslint/use-unknown-in-catch-callback-variable": "warn",
  },
};

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

  ...applyTs({
    mode: "directory",
    files: ["packages/liwi-mongo-example/src/"],
    configs: [...pobConfigs.app],
  }),
  ...applyTs({
    mode: "directory",
    files: ["@todo-example/*/src/"],
    configs: [...pobConfigs.app, warnUnsafeConfig],
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
      warnUnsafeConfig,
      {
        rules: {
          "react/function-component-definition": [
            "error",
            {
              namedComponents: ["function-declaration", "arrow-function"],
              unnamedComponents: "arrow-function",
            },
          ],
        },
      },
    ],
  }),
  ...applyTs({
    mode: "directory",
    files: [
      "packages/liwi-{mongo,resources,resources-client,resources-direct-client,resources-server,resources-void-client,resources-websocket-client,resources-websocket-server,store,subscribe-store}/src/",
    ],
    configs: [
      warnUnsafeConfig,
      {
        rules: {
          "@typescript-eslint/no-floating-promises": "warn",
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
      warnUnsafeConfig,
      {
        rules: {
          "@typescript-eslint/no-floating-promises": "warn",
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
];
