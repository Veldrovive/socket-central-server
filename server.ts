require('source-map-support').install();
process.on('unhandledRejection', console.log);
import config = require("config");
import http = require('http');
import WebSocket = require('ws');
import crypto = require('crypto');
import express = require('express');
import bodyParser = require("body-parser");

import data = require("./db/db");
import com = require("./ComTypes");
const Com = com.Com;

import dh = require("./data");

export class SocketServer {
    serverConfig: {ip: string, port: number}
    server?: http.Server;
    express?: express;
    ws?: WebSocket.Server;

    dbConfig: {user: string, host: string, database: string, password: string, port: number};
    database?: data.db;

    users: dh.User[];

    callbacks: {[key: string]: dh.App};

    constructor() {
        this.dbConfig = config.get("dbConfig");
        this.serverConfig = config.get("server");
        this.callbacks = {};
        this.users = [];
    }

    static async build(): Promise<SocketServer> {
        const wsServer = new SocketServer();

        const serverUp = await wsServer._startServer();
        const dbUp = await wsServer._connectDatabase();
        const usersAdded = await wsServer._buildUsers();
        const wsUp = await wsServer._setupWsServer();
        const httpUp = await wsServer._startHttpRoutes();

        return wsServer;
    }

    async setup() {
        const serverUp = await this._startServer();
        const dbUp = await this._connectDatabase();
        const usersAdded = await this._buildUsers();
        const wsUp = await this._setupWsServer();
        const httpUp = await this._startHttpRoutes();
    }

    async _startServer(): Promise<boolean> {
        this.express = express();
        this.express.use(bodyParser.urlencoded({ extended: false }));
        this.express.use(bodyParser.json())
        this.server = http.createServer(this.express);
        this.server.listen(this.serverConfig.port, this.serverConfig.ip);
        console.log("Server is listening");
        return true;
    }

    async _startHttpRoutes() {
        this.express.get("/ping", (req, res) => {
            res.send("pong");
        })

        this.express.post("/relay_command", (req, res) => {
            try{
                let body;
                try {
                    body = JSON.parse(req.body);
                } catch (err) {
                    body = req.body;
                }
                const {command, meta, target, token} = body;
                if(command === undefined) throw "No Command Specified";
                const user = this.users.find(user => user.token === token);
                if (!user) throw "No user with specified token";
                const relay = com.Com.command(undefined, command, meta, "relay", {targets: target, user})
                this.relayCommand(relay);
                return res.send("Relayed command: " + command + " with meta " + meta + " to target: " + target);
            } catch(err) {
                return res.send("Failed to relay command: " + err);
            }
        })
    }

    async _connectDatabase(): Promise<boolean> {
        this.database = new data.db(this.dbConfig);
        console.log("Database is connecting");
        return await this.database.setup();
    }

    async _buildUsers(): Promise<boolean> {
        this.users = [];
        const allUsers = await this.database.users.getAll();
        if (typeof allUsers === "string") {
            return false;
        } else {
            for (const userObj of allUsers) {
                const user = await dh.User.build(this.database, userObj.username);
                if (user) this.users.push(user);
            }
        }
        return true;
    }

    async _setupWsServer(): Promise<boolean> {
        this.ws = new WebSocket.Server({ server: this.server });
        console.log("Websocket server is binding");
        this.ws.on("connection", client => {
            let registered = false;
            client.on("message", async rawData => {
                // let data: {type: string, payload: any} = JSON.parse(rawData.toString());
                // console.log("Base Message Data:", JSON.parse(rawData.toString()))
                const c = Com.fromJsonStr(rawData.toString());
                if (c === false) {
                    if (!registered) {
                        console.log("Unregistered client tried to command or respond");
                        client.send(Com.error(505, "Client is not registered").send());
                    }
                    return;
                } else if (c instanceof com.Error ) {
                    client.send(c.send())
                } else if (c.type === "register") {
                    // @ts-ignore
                    const payload: com.Register = c.payload;
                    const err = await this.registerClient(client, payload);

                    if (err) {
                        client.send(Com.genericResponse("registerResponse", false, err).send());
                    } else {
                        client.send(Com.genericResponse("registerResponse", true, "App connected").send());
                        registered = true;
                    }
                } else if (c.type === "addUser") {
                    // @ts-ignore
                    const payload: com.AddUser = c.payload;
                    const err = await this.addUser(payload);

                    if (err) {
                        client.send(Com.error(502, err).send());
                    } else {
                        client.send(Com.genericResponse("info", true, "Added new user").send());
                    }
                } else if (c.type = "addDevice") {
                    //@ts-ignore
                    const payload: com.AddDevice = c.payload;
                    const err = await this.addDevice(payload);

                    if (err) {
                        client.send(Com.error(503, err).send());
                    } else {
                        client.send(Com.genericResponse("info", true, "Added new device").send());
                    }
                }
            });
        });
        return true;
    }

    async addDevice(payload: com.AddDevice): Promise<undefined | string> {
        const user = this.users.find(u => u.token === payload.uToken);
        if(!user) {
            return "User is not loaded";
        }
        const added = await user.addDevice(payload.devName);
        if (!added) {
            return "Failed to add device. A device with this name probably exists.";
        }
    }

    async addUser(payload: com.AddUser): Promise<undefined | string> {
        // Add the user to the database
        const added = await this.database.users.add(payload.uToken, payload.username, payload.fullName);
        if (!added) {
            return "Failed to add user to database. A user with this name probably exists."
        }

        const newUser = await dh.User.build(this.database, payload.username);
        this.users.push(newUser);
    }

    // data: {gToken: string, devName: string, appName: string}
    async registerClient(socket: WebSocket, payload: com.Register): Promise<undefined | string> {
        // const { gToken, devName, appName } = data;
        const user = this.users.find(u => u.token === payload.gToken);
        if (!user) {
            return "User is not registered in the database";
        }

        const device = user.devices.find(d => d.devName === payload.devName);
        if (!device) {
            return "Device is not registered in the databse"
        }

        let app = device.apps.find(a => a.appName === payload.appName);
        if (app) {
            const {status, lastOnline} = await app.status();
            if (status) {
                // Then the client is trying to connect while already connected
                return "App is already connected"
            }
        } else {
            // Then the app does not yet exist
            app = await device.addApp(payload.appName);
        }
        if(app) await app.setSocket(socket);
    }

    async relayCommand(c: any) {
        // @ts-ignore - We know it is command
        const com: com.Command = c.payload
        const fromApp = com.fromApp;
        let user;
        if (com.user) {
            user = com.user;
        } else {
            if (!fromApp) return false;
            user = fromApp.device.user;
            this.callbacks[com.callbackId] = fromApp;
        }
        for (const device of user.devices) {
            for (const app of device.apps) {
                if (Array.isArray(com.targets) && com.targets.findIndex(target => app.appName === target) === -1) {
                    // Then this app is not a target
                    continue;
                }
                if (typeof(com.mirror) === "boolean" && !com.mirror && app === fromApp) {
                    // Then this app is a mirror and
                    continue;
                }
                await app.handleCommand(c);
            }
        }
    }

    // fromApp: dh.App, callbackId: string, meta: any
    async relayResponse(c: any) {
        // @ts-ignore - We know it is a callback
        const com: com.Callback = c.payload
        const initiator = this.callbacks[com.callbackId];
        if (initiator) {
            if (!com.fromApp) return false;
            initiator.handleResponse(c);
        }
    }
}

export const ServerHandler = (function(){
    var instance: SocketServer;
    return {
        getInstance: async function(){
            if (instance == null) {
                instance = new SocketServer();
                await instance.setup();
            }
            return instance;
        }
   };
})();

async function main() {
    const server = await ServerHandler.getInstance();
    
}

main();