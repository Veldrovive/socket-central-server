import WebSocket = require('ws');

import data = require("./db/db");
import com = require("./ComTypes");
const Com = com.Com;
import server = require("./server");
import { Connection } from 'pg';

export class User {
    username: string;
    token: string;
    devices: Device[];

    db: data.db;

    async updateToken(): Promise<boolean> {
        const token = await this.db.users.getToken(this.username);
        if (token) this.token = token;
        return token == false;
    }

    constructor(db: data.db, username: string) {
        this.db = db;
        this.username = username;
        this.devices = [];
        this.token = "";
    }

    /**
     * Builds a new instance of a User
     * @param db A database instance
     * @param username The users unique username
     */
    static async build(db: data.db, username: string): Promise<User | undefined> {
        let user = new User(db, username);

        if(await user.updateToken()) return;
        
        await user.updateDevices();

        return user;
    }

    /**
     * @return The token for the given username
     */
    get utoken(): Promise<string | false> {
        return this.db.users.getToken(this.username);
    }

    /**
     * The full name of the current user
     */
    get full_name(): Promise<string | false> {
        return this.db.users.getFullName(this.username)
    }

    /** 
     * Adds a new device for the user
     * @param name The name of the new device
    */
    async addDevice(name: string): Promise<Device | undefined> {
        const newId = await this.db.devices.addDevice(this.username, name);
        if (newId) {
            const device = await Device.build(this.db, this, newId);
            this.devices.push(device);
            return device
        }
    }

    async updateDevices(): Promise<Device[]> {
        this.devices = [];
        let devices = await this.db.users.getDevices(this.username);
        for (let device of devices) {
            let devObj = await Device.build(this.db, this, device.dev_id);
            this.devices.push(devObj);
        }
        return this.devices;
    }
}

export class Device {
    devName: string;
    devId: string;
    user: User;
    apps: App[];

    db: data.db;

    // Getters
    async updateDevName() {
        this.devName = (await this.getOwnData()).dev_name;
    }

    async username(): Promise<string> {
        return (await this.getOwnData()).username;
    }

    async status(): Promise<{status: boolean, lastOnline: Date}> {
        const data = await this.getOwnData();
        return {status: data.status, lastOnline: data.last_online};
    }

    async getOwnData(): Promise<{username: string, dev_name: string, dev_id: string, last_online: Date, status: boolean}> {
        return (await this.db.devices.getDevices({devIds: [this.devId]}))[0]
    }

    constructor(db: data.db, user: User, devId: string){
        this.db = db;
        this.devId = devId;
        this.user = user;
        this.apps = [];
        this.devName = "";
    }

    /**
     * 
     * @param db A database instance
     * @param devName The name of the device
     * @param devId The id of the device
     */
    static async build(db: data.db, user: User, devId: string): Promise<Device> {
        const dev = new Device(db, user, devId);

        await dev.updateApps();
        await dev.updateDevName();

        return dev;
    }

    async addApp(appName: string, appGroup?: string): Promise<App | undefined> {
        const newId = await this.db.apps.newApp(this.devId, appName, appGroup);
        if (newId) {
            const app = await App.build(this.db, this, newId);
            this.apps.push(app);
            return app;
        }
    }

    /**
     * Creates the app list and populates it with App objects this device owns
     */
    async updateApps(): Promise<App[]> {
        this.apps = [];
        const apps = await this.db.devices.getApps(this.devId);
        for (const app of apps) {
            const appObj = await App.build(this.db, this, app.app_id);
            this.apps.push(appObj);
        }
        return this.apps;
    }

    async updateStatus(): Promise<void> {
        let status = false;
        for (const app of this.apps) {
            const appStatus = (await app.status()).status;
            if (appStatus) status = true;
        }
        this.db.devices.updateStatus(this.devId, status);
        return;
    }
}

export class App {
    appId: string;
    appName: string;
    device: Device;
    socket: WebSocket | undefined;

    interval: any;

    db: data.db;
    ss: server.SocketServer;

    async updateAppName() {
        this.appName = (await this.getOwnData()).app_name;
    }

    async appGroup(): Promise<string> {
        return (await this.getOwnData()).app_group;
    }

    async devId(): Promise<string> {
        return (await this.getOwnData()).dev_id;
    }

    async status(): Promise<{status: boolean, lastOnline: Date}> {
        const data = await this.getOwnData();
        return {status: data.status, lastOnline: data.last_online};
    }

    async getOwnData(): Promise<{status: boolean, last_online: Date, app_group: string, app_name: string, app_id: string, dev_id: string}> {
        return (await this.db.apps.getApps({appIds: [this.appId]}))[0];
    }

    constructor(db: data.db, ss: server.SocketServer, device: Device, appId: string) {
        this.appId = appId;
        this.device = device;
        this.db = db;
        this.appName = "";
        this.ss = ss;
        this.interval = -1;
    }

    /**
     * Creates an app object and populates neccesary data
     * @param db The databse instance this app belongs to
     * @param appId The id of the app to build
     */
    static async build(db: data.db, device: Device, appId: string, socket?: WebSocket): Promise<App> {
        let socketServer = await server.ServerHandler.getInstance();
        const app = new App(db, socketServer, device, appId);

        if (socket) {
            await app.setSocket(socket);
        } else {
            await app.setStatus(false);
        }
        await app.updateAppName();

        return app;
    }

    /**
     * Starts a loop that checks if the connection has been forcefully broken such that "close" message is never sent
     */
    startHeartbeat() {
        let isAlive = true;
        this.socket.on("pong", () => {
            isAlive = true;
        })
        this.interval = setInterval(() => {
            if (!isAlive) {
                this.socket.terminate();
                this.setStatus(false);
                clearInterval(this.interval);
            }
            this.socket.ping();
            isAlive = false;
        }, 30000)
    }

    /**
     * Updates the app to use a new socket and sets the status to online
     * @param socket The socket connection to the client
     */
    async setSocket(socket: WebSocket) {
        // This needs logic to handle relaying messages and disconnections
        if (this.socket) {
            // Then we should do cleanup on this old socket
            // TODO: Do cleanup of old socket
            this.socket.terminate();
        }

        this.socket = socket;
        await this.setStatus(true);

        this.socket.on("close", () => {
            this.setStatus(false);
            clearInterval(this.interval);
        })
        this.startHeartbeat();

        this.socket.on("open", () => {
            this.setStatus(true);
        })

        this.socket.on("message", async rawData => {
            let data: {type: string, payload: any} = JSON.parse(rawData.toString());

            if (data["type"] === "command") {
                let content: {command: string, targets?: string[], mirror?: boolean, meta: any, callbackId: string} = data.payload;
                this.sendCommand(content.command, content.meta, content.callbackId, { targets: content.targets, mirror: content.mirror });
            }

            if (data["type"] === "response") {
                let content: { callbackId: string, meta: any } = data.payload;
                this.sendResponse(content.callbackId, content.meta);
            }
        })
    }

    /**
     * Sets the status of the device in the database
     * @param status The new status to update to
     */
    async setStatus(status: boolean, log: boolean = true) {
        await this.db.apps.updateStatus(this.appId, status);
        this.device.updateStatus();
        if (log) {
            await this.db.logs.logStatus(this, status);
        }
    }

    /**
     * 
     * @param command The name of the command
     * @param meta Data to send with the command
     * @param info 
     */
    async sendCommand(command: string, meta: any, callbackId: string, info: {targets?: string[], mirror?: boolean}): Promise<boolean> {
        const reqId = await this.db.logs.logCommand(this, command, callbackId, meta, info.targets);
        this.setStatus(true, false);
        if (!reqId) {
            return false;
        } else {
            const com = Com.command(this, command, meta, callbackId, info);
            // this.ss.relayCommand(this, command, meta, reqId, info);
            this.ss.relayCommand(com);
            return true;
        }
    }

    async sendResponse(callbackId: string, meta: any) {
        const com = Com.response(this, callbackId, meta);
        this.setStatus(true, false);
        await this.db.logs.logResponse(this, callbackId, meta);
        this.ss.relayResponse(com);
    }

    async handleCommand(com: com.Com): Promise<boolean> {
        if (this.socket) {
            this.socket.send(com.send());
            return true;
        } else {
            return false;
        }
        
    }

    async handleResponse(com: com.Com) {
        if (this.socket) {
            this.socket.send(com.send());
        }
    }
}