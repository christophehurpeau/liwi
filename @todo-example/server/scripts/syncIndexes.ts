import "nightingale-app-console";
import { runIndexesCli } from "liwi-mongo";
import { mongoConnection, mongoRegistry } from "../src/stores/index.ts";

process.exitCode = await runIndexesCli({
  registry: mongoRegistry,
  connection: mongoConnection,
});
