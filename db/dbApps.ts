import pg = require("pg");
import t = require("./table");
import shortid = require("shortid");

export class dbApps extends t.Table{
	constructor(client: pg.Pool, tables: object){
		super(client, tables);
		this.setupCommands = [
			`CREATE TABLE IF NOT EXISTS socketserver.apps (
                dev_id VARCHAR(14),
                app_id VARCHAR(14) PRIMARY KEY,
                app_name VARCHAR,
                app_group VARCHAR,
                last_online TIMESTAMPTZ,
                status BOOLEAN,
                FOREIGN KEY (dev_id) REFERENCES socketserver.devices (dev_id)
			);`,
		]
    }

    /**
     * Puts a new app in the database and returns its new id
     * @param devId The id of the device this app is running on
     * @param appName The name of the app
     * @param appGroup The group the app belongs to
     */
    async newApp(devId: string, appName: string, appGroup?: string): Promise<string | false> {
        const id = shortid.generate();
        if (!appGroup) appGroup = "";
        const existing = await this.query("SELECT * FROM socketserver.apps WHERE dev_id=$1 AND app_name=$2", [devId, appName]);
        if (existing.rowCount > 0) return false;
        const res = await this.query("INSERT INTO socketserver.apps(dev_id, app_id, app_name, app_group, last_online, status) VALUES ($1, $2, $3, $4, $5, $6)", [
            devId, id, appName, appGroup, new Date(), false
        ]);
        if(res.rowCount > 0) return id;
        return false;
    }
    
    /**
     * Gets a list of apps assigned to this device
     * @param devId The id of the device
     * @param appIds An optional list of devices to get devices on
     */
    async getApps(data: {devId?: string, appIds?: string[]}): Promise<{status: boolean, last_online: Date, app_group: string, app_name: string, app_id: string, dev_id: string}[]> {
        let rawApps;
        const {devId, appIds} = data;
        try{
            if (!devId && appIds) {
                rawApps = await this.query("SELECT status, last_online, app_group, app_name, app_id, dev_id FROM socketserver.apps WHERE app_id = ANY($1)", [appIds]);
            } else if (!appIds && devId) {
                rawApps = await this.query("SELECT status, last_online, app_group, app_name, app_id, dev_id FROM socketserver.apps WHERE dev_id=$1", [devId]);
            } else if (appIds && devId) {
                rawApps = await this.query("SELECT status, last_online, app_group, app_name, app_id, dev_id FROM socketserver.apps WHERE dev_id=$1 AND app_id = ANY($2)", [devId, appIds]);
            } else {
                return [];
            }
            return rawApps.rows.map((elem: {status: boolean, last_online: Date, app_group: string, app_name: string, app_id: string, dev_id: string}) => {
                return {status: elem["status"], last_online: new Date(elem["last_online"]), app_group: elem["app_group"], app_name: elem["app_name"], app_id: elem["app_id"], dev_id: elem["dev_id"]};
            })
        } catch(err) {
            console.log("Failed to get apps:", err);
            return []
        }
    }

    /**
     * Sets the status of the app
     * @param appId The id of the app
     * @param status The new status of the app
     */
    async updateStatus(appId: string, status: boolean) {
        if (status) {
            await this.query("UPDATE socketserver.apps SET status=$1, last_online=$2 WHERE app_id=$3", [status, new Date(), appId]);
        } else {
            await this.query("UPDATE socketserver.apps SET status=$1 WHERE app_id=$2", [status, appId]);
        }
    }
}
