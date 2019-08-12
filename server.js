const io = require('socket.io')(process.env.PORT || 80);
const shortid = require("shortid");

console.log("Server starting");

const registered_clients = {};

io.on("connection", (socket) => {
	let name;
	console.log("Client connecting");

	socket.on("register", (data={}, ack) => {
		({name} = data);
		const exists = registered_clients.hasOwnProperty(name);
		if(!exists){
			registered_clients[name] = {
				socket: socket,
				id: shortid.generate(),
				connected: true
			}
			socket.emit("registered");
			console.log("Resistered new client",name);
		}else if(!registered_clients[name].connected){
			registered_clients[name].socket = socket;
			registered_clients[name].connected = true;
			socket.emit("registered");
			ack(true);
			console.log("Registered old client",name);
		}else{
			socket.emit("register_failed", {error: 450, message: "Client already connected"});
			socket.disconnect();
			console.log("Failed to register client",name,"since it was already connected");
		}
	})

	socket.on("get_id", (data={}, ack) => {
		let {appName} = data;
		if(!appName) appName = name;
		const client = registered_clients[appName];
		if(client){
			socket.emit("get_id_successful", client.id);
			ack({success: true, id: client.id});
		}else{
			socket.emit("get_id_failed", {error: 440, message: "Client not registered"});
			ack({success: false, error: 440, message: "Client not registered"});
		}
	})

	socket.on("get_clients", (ack) => {
		const clients = [];
		Object.keys(registered_clients).forEach(name => {
			clients.push([name, registered_clients[name].id, registered_clients[name].connected]);
		})
		socket.emit("get_clients_successful", clients);
		ack(clients);
	})

	socket.on("command", (data={}, ack) => {
		console.log("Relaying",data);
		const {mirror=false, target, command, meta} = data;
		if(target){
			const client = registered_clients[target];
			if(!client){
				ack({success: false, error: 440, message: "Client not registered"});
				return socket.emit("command_failed", {success: false, error: 440, message: "Client not registered"});
			}else{
				if(!client.connected) {
					ack({success: false, error: 441, message: "Client not connected"});
					return socket.emit("command_failed", {success: false, error: 441, message: "Client not connected"});
				}
				client.socket.emit("command", {command: command, meta: meta});
				ack({success: true});
				return socket.emit("command_successful");
			}
		}else{
			if(mirror){
				io.emit("command", {command: command, meta: meta});
			}else{
				socket.broadcast.emit("command", {command: command, meta: meta});
			}
			ack({success: true});
			return socket.emit("command_successful");
		}
	})

	socket.on("disconnect", () => {
		registered_clients[name].connected = false;
		io.emit("client_disconnect", {name: name, id: registered_clients[name].id});
		console.log("Client disconnected:",name);
	})
})
