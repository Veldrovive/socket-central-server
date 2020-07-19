import pg = require("pg");
import shortid = require("shortid");
import t = require("./table");
import dh = require("../data");

export class dbLogs extends t.Table{
	constructor(client: pg.Pool, tables: object){
        super(client, tables);
        // callback_id is the id of the log that this call is responding to.
		this.setupCommands = [
			`CREATE TABLE IF NOT EXISTS socketserver.logs (
                username VARCHAR,
                dev_id VARCHAR(14),
                app_id VARCHAR(14),
                time TIMESTAMPTZ,
                type VARCHAR,
                content TEXT,
                callback_id VARCHAR(14),
                log_id VARCHAR(14) PRIMARY KEY,
                targets VARCHAR,
                FOREIGN KEY (username) REFERENCES socketserver.users (username),
                FOREIGN KEY (dev_id) REFERENCES socketserver.devices (dev_id),
                FOREIGN KEY (app_id) REFERENCES socketserver.apps (app_id)
			);`,
		]
    }
    
    /**
     * Adds a new log for a request
     * @param appId The id of the app sending the request
     * @param type The type of request. Options: ["command", "response", "status"]
     * @param content The data that fills the request
     * @param info Metadata that fills out command info
     */
    async addLog(app: dh.App, type: string, content: {command?: string, meta?: any, status?: boolean}, info: {log_id?: string, targets?: string[], callbackId?: string}): Promise<string | false> {
        let { targets, log_id, callbackId } = info;

        const appId = app.appId;
        const dev: dh.Device = app.device;
        const devId = dev.devId;
        const username = dev.user.username;

        log_id = log_id ? log_id : shortid.generate();

        const res = await this.query("INSERT INTO socketserver.logs(username, dev_id, app_id, time, type, content, callback_id, log_id, targets) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [
            username, devId, appId, new Date(), type, JSON.stringify(content), callbackId, log_id, JSON.stringify(targets)
        ]);

        return log_id;
    }

    async logCommand(app: dh.App, command: string, callbackId: string, meta?: any, targets?: string[]) {
        return await this.addLog(app, "command", {command, meta}, {targets, callbackId});
    }

    async logResponse(app: dh.App, callbackId: string, meta?: any) {
        return await this.addLog(app, "response", {meta}, {callbackId});
    }

    async logStatus(app: dh.App, status: boolean) {
        return await this.addLog(app, "status", {status}, {});
    }
}