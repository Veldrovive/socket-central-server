var socket = require('socket.io-client')('http://127.0.0.1:8000');
const crypto = require('crypto');
console.log("Attempting to connect");

uname = "Veld"
token = "12345"
dName = "TestDev"

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

async function test_add_user(){
	const ack = (suc) => {
		console.log("Added: ", suc);
	}
	socket.emit("create_user", {token: "12345", username: "Veld", fullName: "Aidan Dempster"}, ack);
}

async function test(){
	// console.log("Testing id");
	// const id = await getId();
	// console.log(id);

	// console.log("Testing command");
	// await sendCommand();
	// console.log("Sent command");
}

function command(command, meta) {
	return new Promise(resolve => {
		const hash = crypto.createHmac('sha256', token)
			.update(`${uname}:${dName}-${command}`)
			.digest('hex');
		socket.emit(command, meta, (res) => {
			resolve(res);
		})
	})
}

socket.on("connect", () => {
	console.log("Connected to server");
	// const hash = crypto.createHmac('sha256', "12345")
    //                .update("Veld:TestDev-register")
    //                .digest('hex');
	// socket.emit("register", {username: "Veld", hmac: hash, deviceName: "TestDev"}, onRegistered);
	// function onRegistered(){
	// 	// test();
	// }
	command("register", {username: "Veld", hmac: hash, deviceName: "TestDev"})
		.then(res => {
			console.log("Server responded to register with: ", res);
		})
});

socket.on("disconnect", () => {
	console.log("Disconnected from server");
});

test();