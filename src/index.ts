import log from "loglevel";
import { loadEnv } from "./utils/loadEnv";
import { Storage } from "./storage";
import express from "express";
import morgan from "morgan";
import { Address } from "turtlecoin-utils";
import { IUserRecord } from "./types";
import objectHash from "object-hash";

// load the environment variables
loadEnv();
log.setLevel("debug");

async function main() {
    const storage = await Storage.create();
    const app = express();

    app.use(express.json());
    app.use(morgan("dev"));

    app.post("/users/submit", async (req, res) => {
        const submittedUser: Partial<IUserRecord> = req.body;

        if (!submittedUser.userID) {
            console.log("No user ID.");
            res.sendStatus(400);
            return;
        }
        const hash = hashUser(submittedUser);
        if (hash !== submittedUser.userHash) {
            res.sendStatus(400);
            return;
        }

        try {
            await storage.createUserRecord(submittedUser);
            res.sendStatus(200);
        } catch (err) {
            console.log(err);
            res.sendStatus(409);
        }
    });

    app.post("/users/check", async (req, res) => {
        const submittedMap: Map<string, string> = new Map(
            Object.entries(req.body)
        );
        const currentMap: Map<
            string,
            string
        > = await storage.getUserHashTable();

        const neededUsers: number[] = [];
        for (const [key, val] of submittedMap.entries()) {
            if (currentMap.get(key) !== val) {
                neededUsers.push(parseInt(key));
            }
        }
        res.json(neededUsers);
    });

    app.post("/keys/check", async (req, res) => {
        const addresses: string[] = req.body;
        const missing = await storage.checkForMissingAddresses(addresses);
        res.json(missing);
    });

    app.post("/keys/submit", async (req, res) => {
        const { spendKey, viewKey, address } = req.body;
        if (!spendKey || !viewKey || !address) {
            res.sendStatus(400);
            return;
        }

        const calculatedAddress = await Address.fromKeys(spendKey, viewKey);
        if (address !== (await calculatedAddress.address())) {
            res.sendStatus(400);
            return;
        }

        try {
            await storage.createKey(req.body);
            res.sendStatus(200);
        } catch (err) {
            res.sendStatus(409);
        }
    });

    app.listen(7777, () => {
        log.info("API started on port 7777.");
    });
}

main();

export const hashUser = (user: Partial<IUserRecord>): string => {
    const hashData: Partial<IUserRecord> = { ...user };

    if (
        !hashData.username ||
        !hashData.passwordHash ||
        !hashData.salt ||
        !hashData.address
    ) {
        throw new Error(
            "at least username, passwordhash, salt, and address are required"
        );
    }
    delete hashData.recordID;
    delete hashData.userID;
    delete hashData.userHash;
    delete hashData.createdAt;
    return objectHash(hashData);
};
