import { AbstractConnection } from "liwi-store";
import mongodb from "mongodb";
import { Logger } from "nightingale-logger";

const logger = new Logger("liwi:mongo:MongoConnection");

export interface MongoConfig {
  host?: string;
  port?: number | string;
  database: string;
  user?: string;
  password?: string;
  authSource?: string;
}

interface BuildMongoConnectionStringParams extends MongoConfig {
  redactCredentials: boolean;
}

export const buildMongoConnectionString = ({
  host = "localhost",
  port = "27017",
  database,
  user,
  password,
  authSource,
  redactCredentials,
}: BuildMongoConnectionStringParams): string =>
  `mongodb://${
    user
      ? `${
          redactCredentials
            ? `${user.slice(0, 2)}[redacted]`
            : encodeURIComponent(user)
        }:${
          redactCredentials ? "[redacted]" : encodeURIComponent(password ?? "")
        }@`
      : ""
  }${host}:${port}/${encodeURIComponent(database)}${
    authSource ? `?authSource=${encodeURIComponent(authSource)}` : ""
  }`;

export default class MongoConnection extends AbstractConnection {
  _connection?: mongodb.MongoClient;

  _connecting?: Promise<mongodb.MongoClient>;

  connectionFailed?: boolean;

  // TODO interface
  constructor(config: MongoConfig) {
    super();

    if (!config.database) {
      throw new Error("Missing config database");
    }

    const connectionString = buildMongoConnectionString({
      ...config,
      redactCredentials: false,
    });
    const connectionStringRedacted = buildMongoConnectionString({
      ...config,
      redactCredentials: true,
    });

    this.connect(connectionString, connectionStringRedacted);
  }

  connect(connectionString: string, connectionStringRedacted: string): void {
    logger.info("connecting", { connectionStringRedacted });

    const connectPromise = mongodb.MongoClient.connect(connectionString)
      .then((connection) => {
        logger.info("connected", { connectionStringRedacted });
        connection.on("close", () => {
          logger.warn("close", { connectionStringRedacted });
          this.connectionFailed = true;
          this.getConnection = () => {
            throw new Error("MongoDB connection closed");
          };
        });
        connection.on("timeout", () => {
          logger.warn("timeout", { connectionStringRedacted });
          this.connectionFailed = true;
          this.getConnection = () => {
            throw new Error("MongoDB connection timeout");
          };
        });
        connection.on("reconnect", () => {
          logger.warn("reconnect", { connectionStringRedacted });
          this.connectionFailed = false;
          this.getConnection = () => Promise.resolve(this._connection!);
        });
        connection.on("error", (err) => {
          logger.warn("error", { connectionStringRedacted, err });
        });

        this._connection = connection;
        this._connecting = undefined;
        this.getConnection = () => Promise.resolve(this._connection!);
        return connection;
      })
      .catch((error: unknown) => {
        logger.info("not connected", { connectionStringRedacted });
        console.error((error as Error).message || error);
        // throw err;
        process.nextTick(() => {
          // eslint-disable-next-line unicorn/no-process-exit
          process.exit(1);
        });

        throw error;
      });

    this.getConnection = () => Promise.resolve(connectPromise);
    this._connecting = this.getConnection();
  }

  getConnection(): Promise<mongodb.MongoClient> {
    throw new Error("call connect()");
  }

  async close(): Promise<void> {
    this.getConnection = () => Promise.reject(new Error("Connection closed"));
    if (this._connection) {
      await this._connection.close();
      this._connection = undefined;
    } else if (this._connecting) {
      await this._connecting;
      await this.close();
    }
  }
}
