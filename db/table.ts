import pg = require("pg");

// Methods in tables should interact directly with their database and the routers should handle higher level interactions
export class Table{
	pool: pg.Pool;
	tables: any;
	setupCommands: string[] = []

	constructor(client: pg.Pool, tables: any){
		this.pool = client;
		this.tables = tables;
	}

	async query(call: string | pg.QueryConfig, values?: any[]): Promise<any>{
		const client = await this.pool.connect();
		let res;
		try{
			if(typeof call === "string"){
				res = await client.query(call, values);
			}else{
				res = await client.query(call);
			}
		}catch(e){
			throw this.rethrowError(e);
		}
		client.release();
		return res;
	}

	async runSetup(): Promise<boolean>{
		for(const commandIndex in this.setupCommands){
			const command: string = this.setupCommands[commandIndex];
			try{
				const res: any = await this.pool.query(command);
			}catch(e){
				console.log("Failed to run command: ",command);
				console.log("Error: ",e);
			}
		}
		return true;
	}

	rethrowError(e: any): {routine: string, code: number}{
		const {code: ErrorCode, routine: error, constraint}: {code: string, routine: string, constraint: string} = e;
		if(ErrorCode === "23505") return {routine: "Unique column violation", code: 400};
		if(ErrorCode === "23503") return {routine: "Key must exist in foreign table", code: 400};
		if(ErrorCode === "23502") return {routine: "Value must not be null", code: 400};
		if(ErrorCode === "22P02") return {routine: "UUID string was probably misformatted", code: 400};

		if(ErrorCode === "42883") return {routine: "SQL Function used was not defined", code: 500};
		if(ErrorCode === "42703") return {routine: "Column is not defined", code: 500};
		if(ErrorCode === "42P01") return {routine: "Table is not defined", code: 500};
		if(ErrorCode === "42601") return {routine: "SQL statement has a syntax error", code: 500};

		if(ErrorCode === "23514" && constraint.includes("normalized")) return {routine: "Failed on normalization check. Check that your inputs are between 0 and 1: "+constraint, code: 400};
		if(ErrorCode === "23514" && constraint.includes("doubled")) return {routine: "Tried to insert into a table with a unique property on two columns: "+constraint, code: 400};

		return e;
	}
}