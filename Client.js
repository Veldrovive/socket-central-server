class Client{
	constructor(params){
		({
			name: this.name,
			url: this.url = "http://localhost:80",
			onConnect: this.onConnect = () => {},
			onDisconnect: this.onDisconnect = () => {}
		} = params);
		this.commandMap = {};
	}

	connect(url){
		return new Promise((resolve, reject) => {
			this.socket = io(url || this.url);
			this.socket.on("connect", () => {
				this.socket.emit("register", {name: this.name}, (data) => {
					const {success, error, message} = data;
					if(success){
						this.onConnect();
						return resolve();
					}else{
						return reject({error: error, message: message});
					}
				});
			})
		})
	}

	disconnect(){
		this.socket.close();
	}

	static async setup(params){
		const client = new Client(params);
		await client.connect();
		client.socket.on("command", (data) => client.handleCommand(data.command, data.meta));
		client.socket.on("disconnect", (reason) => client.onDisconnect(reason));
		return client;
	}

	handleCommand(command, meta){
		if(this.commandMap.hasOwnProperty(command)){
			this.commandMap[command](meta);
		}
	}

	getId(appName){
		return new Promise((resolve, reject) => {
			this.socket.emit("get_id", {appName: appName}, (data) => {
				const {success, id, error, message} = data;
				if(success){
					return resolve(id);
				}else{
					return reject({error: error, message: message});
				}
			})
		})
	}

	getClients(){
		return new Promise((resolve, reject) => {
			this.socket.emit("get_clients", (data) => {
				const {success, clients, error, message} = data;
				if(success){
					return resolve(clients);
				}else{
					return reject({error: error, message: message});
				}
			})
		})
	}

	getPastCommands(){
		return new Promise((resolve, reject) => {
			this.socket.emit("get_past_commands", (data) => {
				const {success, commands, error, message} = data;
				if(success){
					return resolve(commands);
				}else{
					return reject({error: error, message: message});
				}
			})
		})
	}

	on(command, callback){
		if(command === "disconnect") return this.onDisconnect = callback;
		if(command === "connect") return this.onConnect = callback;
		this.commandMap[command] = callback;
	}

	removeCallback(command){
		this.commandMap[command] = () => {};
	}

	send(name, meta, target, mirror=false){
		return new Promise((resolve, reject) => {
			this.socket.emit("command", {command: name, meta: meta, target: target, mirror: mirror}, (data) => {
				const {success, targets, error, message} = data;
				if(success){
					return resolve(targets);
				}else{
					return reject({error: error, message: message});
				}
			})
		})
	}
}