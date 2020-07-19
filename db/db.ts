import config = require("config");
import pg = require("pg");
import t = require("./table");
import users = require("./dbUsers");
import devices = require("./dbDevices");
import apps = require("./dbApps");
import logs = require("./dbLogs");

export class db{
	client: pg.Pool;
	setupCommands: string[] = [
		'CREATE SCHEMA IF NOT EXISTS "socketserver";',
	]
	tables: any = {};

	constructor(dbConfig: object){
		if(process.env.DATABASE_URL === undefined){
			this.client = new pg.Pool(dbConfig);
		}else{	
			this.client = new pg.Pool({
			  connectionString: process.env.DATABASE_URL,
			  ssl: true,
			});
        }
        
        this.addTable("users", users.dbUsers);
		this.addTable("devices", devices.dbDevices);
		this.addTable("apps", apps.dbApps);
		this.addTable("logs", logs.dbLogs);
	}

	get users(): users.dbUsers {
		return this.tables['users'];
	}

	get devices(): devices.dbDevices {
		return this.tables["devices"];
	}

	get apps(): apps.dbApps {
		return this.tables["apps"];
	}

	get logs(): logs.dbLogs {
		return this.tables["logs"];
	}

	addTable(name: string, table: any): void{
		this.tables[name] = new table(this.client, this.tables);
	}

	async setup(): Promise<boolean>{
		try{
			await this.client.connect();
		}catch(e){
			console.error("Could not connect to database: ", e);
			throw Error("Failed to connect to database");
		}
		for(const commandIndex in this.setupCommands){
			const command: string = this.setupCommands[commandIndex];
			try{
				const res: any = await this.client.query(command);
			}catch(e){
				console.log("Failed to run command: ",command);
				console.log("Error: ",e);
			}
		}
		for(const table of Object.values(this.tables)){
			await (table as t.Table).runSetup();
		}
		return true;
	}
}
