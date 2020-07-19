import pg = require("pg");
import t = require("./table");

export class dbUsers extends t.Table{
	constructor(client: pg.Pool, tables: object){
		super(client, tables);
		this.setupCommands = [
			`CREATE TABLE IF NOT EXISTS socketserver.users (
				utoken VARCHAR UNIQUE,
				username VARCHAR PRIMARY KEY,
				full_name VARCHAR
			);`,
		]
	}

	async getAll(): Promise<{uToken: string, username: string, fullName: string}[] | string> {
		try {
			const res = await this.query("SELECT * FROM socketserver.users");
			return res.rows.map((elem: {utoken: string, username: string, full_name: string}) => {
				return {uToken: elem["utoken"], username: elem["username"], fullName: elem["full_name"]};
			})
		} catch(err) {
			return "Failed to fetch users";
		}
	}

	/**
	 * Adds a new user to the database
	 * @param uToken The google token for the user
	 * @param username A user chosen unique key
	 * @param fullName The full name of the user given by google or assigned by the user
	 */
	async add(uToken: string, username: string, fullName?: string): Promise<boolean>{
		try {
			const res = await this.query("INSERT INTO socketserver.users(utoken, username, full_name) VALUES($1, $2, $3);", [uToken, username, fullName]);
			return res.rowCount > 0;
		} catch(err) {
			return false;
		}
		
	}

	/**
	 * Removes a user from the database
	 * @param username The unique user defined key
	 */
	async remove(username: string): Promise<boolean>{
		try {
			const res = await this.query("DELETE FROM socketserver.users WHERE username=$1", [username]);
			return res.rowCount > 0;
		} catch(err) {
			return false;
		}
	}

	/**
	 * Checks if a username is already in the database
	 * @param username The unique user defined key
	 */
	async exists(username: string): Promise<boolean> {
		const res = await this.query("SELECT * FROM socketserver.users WHERE username=$1", [username]);
		return res.rowCount > 0;
	}

	/**
	 * Returns the google token for a given user
	 * @param username The unique user defined key
	 */
	async getToken(username: string): Promise<string | false>{
		const rawToken = await this.query("SELECT utoken FROM socketserver.users WHERE username=$1", [username]);
		if (rawToken.rowCount< 1) return false;
		return rawToken.rows[0]["utoken"];
	}

	/**
	 * Returns the full name of the given user
	 * @param username The unique user defined key
	 */
	async getFullName(username: string): Promise<string | false> {
		const rawName = await this.query("SELECT full_name FROM socketserver.users WHERE username=$1", [username]);
		if (rawName.rowCount < 1) return false;
		return rawName.rows[0]["full_name"];
	}

	/**
	 * Returns a list of the user's registered devices
	 * @param username The unique user defined key
	 */
	async getDevices(username: string): Promise<{username: string, dev_name: string, dev_id: string, last_online: Date, status: boolean}[]>  {
		return this.tables["devices"].getDevices({username});
	}
}