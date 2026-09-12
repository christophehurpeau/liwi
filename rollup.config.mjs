import configs1 from "./packages/extended-json/rollup.config.mjs";
import configs2 from "./packages/liwi-store/rollup.config.mjs";
import configs3 from "./packages/liwi-resources/rollup.config.mjs";
import configs4 from "./packages/liwi-subscribe-store/rollup.config.mjs";
import configs5 from "./packages/liwi-mongo/rollup.config.mjs";
import configs6 from "./packages/liwi-resources-client/rollup.config.mjs";
import configs7 from "./packages/liwi-resources-server/rollup.config.mjs";
import configs8 from "./@todo-example/modules/rollup.config.mjs";
import configs9 from "./packages/liwi-mongo-example/rollup.config.mjs";
import configs10 from "./packages/liwi-resources-direct-client/rollup.config.mjs";
import configs11 from "./packages/liwi-resources-void-client/rollup.config.mjs";
import configs12 from "./packages/liwi-resources-websocket-client/rollup.config.mjs";
import configs13 from "./packages/liwi-resources-websocket-server/rollup.config.mjs";
import configs14 from "./packages/react-liwi/rollup.config.mjs";
import configs15 from "./@todo-example/server/rollup.config.mjs";
import configs16 from "./packages/liwi-resources-websocket-node-client/rollup.config.mjs";

export default [
  ...configs1,
  ...configs2,
  ...configs3,
  ...configs4,
  ...configs5,
  ...configs6,
  ...configs7,
  ...configs8,
  ...configs9,
  ...configs10,
  ...configs11,
  ...configs12,
  ...configs13,
  ...configs14,
  ...configs15,
  ...configs16,
];
