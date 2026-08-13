import type MongoConnection from "../MongoConnection.ts";
import type MongoRegistry from "../MongoRegistry.ts";
export interface RunIndexesCliParams {
    registry: MongoRegistry;
    argv?: readonly string[];
    connection?: MongoConnection;
    log?: (message: string) => void;
    logError?: (message: string) => void;
}
export declare const runIndexesCli: ({ registry, argv, connection, log, logError, }: RunIndexesCliParams) => Promise<number>;
//# sourceMappingURL=runIndexesCli.d.ts.map