var socket = require('socket.io-client')('https://central-socket.herokuapp.com/');
console.log("Attempting to connect");

socket.on("command", (data) => {
	const {command, meta} = data;
	console.log("Recieved command",command, meta);
})

function getId(){
	return new Promise((resolve, reject) => {
		if(socket.disconnected) return reject("No Connection");
		socket.emit("get_id", {}, ack);
		function ack(data){
			const {success, id, error, message} = data;
			if(success){
				return resolve(id);
			}else{
				return reject({error: error, message, message});
			}
		}
	})
}

function sendCommand(){
	return new Promise((resolve, reject) => {
		if(socket.disconnected) return reject("No Connection");
		socket.emit("command", {command: "test_command", meta: [1, 2, 3], mirror: true}, ack);
		function ack(data){
			const {success, error, message} = data;
			if(success){
				return resolve();
			}else{
				return reject({error: error, message, message});
			}
		}
	})
}

async function test(){
	console.log("Testing id");
	const id = await getId();
	console.log(id);

	console.log("Testing command");
	await sendCommand();
	console.log("Sent command");
}

socket.on("connect", () => {
	console.log("Connected to server");
	socket.emit("register", {name: "test"}, onRegistered);
	function onRegistered(){
		test();
	}
});

socket.on("disconnect", () => {
	console.log("Disconnected from server");
});