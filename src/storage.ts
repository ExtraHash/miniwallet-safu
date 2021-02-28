import { EventEmitter } from "events";
import knex from "knex";
import log from "loglevel";
import { IKey, IUserRecord } from "./types";
import fs from "fs";

/**
 * The default IStorage() implementation, using knex and sqlite3 driver
 *
 * @hidden
 */
export class Storage extends EventEmitter {
    private dbPath: string;
    public db: knex<any, unknown[]>;

    public static async create() {
        const storage = new Storage();
        await storage.init();
        return storage;
    }

    private constructor() {
        super();

        this.dbPath = "db.sqlite";
        this.db = knex({
            client: "sqlite3",
            connection: {
                filename: this.dbPath,
            },
            useNullAsDefault: true,
        });
    }

    public async createKey(key: Partial<IKey>) {
        await this.db("keys").insert(key);
    }

    public async close(): Promise<void> {
        log.info("Closing database.");
        await this.db.destroy();
    }

    public async checkForMissingAddresses(queried: string[]) {
        const found: IKey[] = await this.db("keys")
            .select()
            .whereIn("address", queried);

        if (found.length === queried.length) {
            return [];
        }
        return missingElements(
            found.map((add) => add.address),
            queried
        );
    }

    public async getUserHashTable(): Promise<Map<string, string>> {
        const users = await this.db("userRecords").select();
        const userMap = new Map<string, string>();
        for (const user of users) {
            userMap.set(user.userID.toString(), user.userHash);
        }
        return userMap;
    }

    public async createUserRecord(
        userRecord: Partial<IUserRecord>
    ): Promise<void> {
        await this.db("userRecords").insert(userRecord);
    }

    public async init() {
        console.info("Initializing database.");
        try {
            if (!(await this.db.schema.hasTable("keys"))) {
                await this.db.schema.createTable("keys", (table) => {
                    table.increments("keyID");
                    table.string("address").unique();
                    table.string("viewKey");
                    table.string("spendKey").unique();
                });
            }

            if (!(await this.db.schema.hasTable("userRecords"))) {
                await this.db.schema.createTable("userRecords", (table) => {
                    table.increments("recordID");
                    table.integer("userID");
                    table.string("username");
                    table.string("passwordHash");
                    table.string("salt");
                    table.string("address");
                    table.boolean("twoFactor");
                    table.string("totpSecret");
                    table.string("userHash");
                    table
                        .dateTime("createdAt")
                        .notNullable()
                        .defaultTo(this.db.raw("CURRENT_TIMESTAMP"));
                });
            }

            this.emit("ready");
        } catch (err) {
            this.emit("error", err);
        }
    }
}

function missingElements<Type>(checkSet: Type[], masterSet: Type[]) {
    const map = new Map<Type, boolean>();

    for (const value of checkSet) {
        map.set(value, true);
    }

    const missing: Type[] = [];
    for (const val of masterSet) {
        if (!map.get(val)) {
            missing.push(val);
        }
    }

    return missing;
}
