import pg = require("pg");
import shortid = require("shortid");
import t = require("./table");

export class dbDevices extends t.Table{
	constructor(client: pg.Pool, tables: object){
		super(client, tables);
		this.setupCommands = [
			`CREATE TABLE IF NOT EXISTS socketserver.devices (
                username VARCHAR,
                dev_name VARCHAR,
                dev_id VARCHAR(14) PRIMARY KEY,
                last_online TIMESTAMPTZ,
                status BOOLEAN,
                CONSTRAINT doubled_device UNIQUE (username, dev_name),
                FOREIGN KEY (username) REFERENCES socketserver.users (username)
			);`,
		]
    }
    
    /**
     * Get information about all the devices a user has
     * @param username The user to get the devices for
     * @param dev_ids An optional parameter that can be used to filter a specific set of devices
     * @return A promise for an object containing a list of all device ids and names
     */
    async getDevices(data: {username?: string, devIds?: string[]}): Promise<{username: string, dev_name: string, dev_id: string, last_online: Date, status: boolean}[]> {
        let rawDevices;
        const {username, devIds} = data;
        try {
            if (!username && devIds) {
                rawDevices = await this.query("SELECT * FROM socketserver.devices WHERE dev_id = ANY($1)", [devIds]);
            } else if (!devIds && username) {
                rawDevices = await this.query("SELECT * FROM socketserver.devices WHERE username=$1", [username]);
            } else if (username && devIds) {
                rawDevices = await this.query("SELECT * FROM socketserver.devices WHERE username=$1 AND dev_id = ANY($2)", [username, devIds]);
            } else {
                return [];
            }
            return rawDevices.rows.map((elem: {username: string, dev_name: string, dev_id: string, last_online: Date, status: boolean}) => {
                return {username: elem["username"], dev_name: elem["dev_name"], dev_id: elem["dev_id"], last_online: new Date(elem["last_online"]), status: elem['status']}
            })
        } catch(err) {
            console.log("Failed to get devices: ", err);
            return [];
        }
    }

    /**
     * Adds a new device for the given user
     * @param username The unique user defined key
     * @param devName The name for the new device
     */
    async addDevice(username: string, devName: string): Promise<string | false> {
        const id = shortid.generate();
        try {
            const res = await this.query("INSERT INTO socketserver.devices(username, dev_name, dev_id, last_online, status) VALUES ($1, $2, $3, $4, $5)", [
                username, devName, id, new Date(), false
            ]);
            if(res.rowCount > 0) return id;
            return false;
        } catch(err) {
            return false;
        }
    }

    /**
     * Removes a device from the database
     * @param username The unique user defined key
     * @param devId The unique device id
     */
    async removeDevice(username: string, devId: string): Promise<boolean> {
        const rawRes = await this.query("DELETE FROM socketserver.devices WHERE username=$1 AND dev_id=$2", [username, devId]);
        if(rawRes.rowcount > 0) return true;
        return false
    }

    /**
     * Sets the status of the device
     * @param devId The id of the device
     * @param status The new status of the device
     */
    async updateStatus(devId: string, status: boolean) {
        if (status) {
            await this.query("UPDATE socketserver.devices SET status=$1, last_online=$2 WHERE dev_id=$3", [status, new Date(), devId]);
        } else {
            await this.query("UPDATE socketserver.apps SET status=$1 WHERE dev_id=$2", [status, devId]);
        }
    }

    /**
     * Gets the apps that run on the current device
     * @param devId The id of the user's device
     */
    async getApps(devId: string): Promise<{status: boolean, last_online: Date, app_group: string, app_name: string, app_id: string, dev_id: string}[]> {
        return this.tables["apps"].getApps({ devId });
    }
}

