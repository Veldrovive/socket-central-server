import dh = require("./data");

export class Payload {
    setup(data: any): Payload {
        // Takes all arguments of the class
        return new Payload();
    }

    send() {
        // Passes just neccesary information as json
    }

    fromJson(obj: any) {
        // Constructs the object from JSON
    }
}

export class AddDevice extends Payload {
    uToken: string;
    devName: string;

    setup(data: {uToken: string, devName: string}) {
        ({uToken: this.uToken, devName: this.devName} = data);
        return this;
    }

    fromJson(obj: {uToken: string, devName: string}): AddDevice {
        return new AddDevice().setup(obj);
    }

    send() {
        return {uToken: this.uToken, devName: this.devName};
    }
}

export class AddUser extends Payload {
    uToken: string;
    username: string;
    fullName: string;

    constructor() {
        super()
    }

    setup(data: {uToken: string, username: string, fullName: string}) {
        ({uToken: this.uToken, username: this.username, fullName: this.fullName} = data);
        return this;
    }

    fromJson(obj: {uToken: string, username: string, fullName: string}): AddUser {
        return new AddUser().setup(obj);
    }

    send() {
        return {uToken: this.uToken, username: this.username, fullName: this.fullName};
    }
}

export class GenericResponse extends Payload {
    state: boolean = false;
    message: string = "";

    constructor() {
        super();
    }

    setup(data: {state: boolean, message: string}) {
        this.state = data.state;
        this.message = data.message;
        return this;
    }

    fromJson(obj: {state: boolean, message: string}): GenericResponse {
        const res = new GenericResponse();
        res.setup({state: obj.state, message: obj.message})
        return res;
    }

    send() {
        return {state: this.state, message: this.message};
    }
}

export class Register extends Payload {
    /* Example Register
    {
        "type": "register",
        "payload": {
            "gToken": "test-token",
            "devName": "test-device",
            "appName": "test-app"
        }
    }
    */

    gToken: string = "";
    devName: string = "";
    appName: string = "";

    constructor() {
        super();
    }

    setup(data: {gToken: string, devName: string, appName: string}) {
        this.gToken = data.gToken;
        this.devName = data.devName;
        this.appName = data.appName;
        return this;
    }

    static fromJson(obj: {gToken: string, devName: string, appName: string}): Register {
        const res = new Register();
        res.setup({gToken: obj.gToken, devName: obj.devName, appName: obj.appName})
        return res;
    }

    send() {
        return {gToken: this.gToken, devName: this.devName, appName: this.appName};
    }
}

export class Callback extends Payload {
    /* Example Callback
    {
        "type": "response",
        "payload": {
            "callbackId": "897",
            "meta": "Test Response"
        }
    }
    */

    fromApp?: dh.App;
    callbackId: string = "";
    meta: any;

    constructor() {
        super();
    }

    setup(data: {fromApp: dh.App | undefined, callbackId: string, meta: any}) {
        this.fromApp = data.fromApp;
        this.callbackId = data.callbackId;
        this.meta = data.meta;
        return this;
    }

    static fromJson(obj: {callbackId: string, meta: any}): Callback {
        const res = new Callback();
        res.setup({fromApp: undefined, callbackId: obj.callbackId, meta: obj.meta})
        return res;
    }

    send() {
        return {from: this.fromApp?.appName, callbackId: this.callbackId, meta: this.meta};
    }
}

export class Command extends Payload {
    /* Example Command
    {
        "type": "command",
        "payload": {
            "command": "Do Something",
            "meta": "Test",
            "callbackId": "897",
            "targets": ["test-app-2"],
            "mirror": true
        }
    }
    */

    fromApp?: dh.App;
    command: string = "";
    callbackId: string = "";
    targets?: string[];
    mirror?: boolean;
    meta: any;

    constructor() {
        super();
    }

    setup(data: {fromApp: dh.App | undefined, command: string, meta: any, callbackId: string, info: {targets?: string[], mirror?: boolean}}) {
        this.fromApp = data.fromApp;
        this.command = data.command;
        this.meta = data.meta;
        this.callbackId = data.callbackId;
        this.targets = data.info.targets;
        this.mirror = data.info.mirror;
        return this;
    }

    static fromJson(obj: {command: string, meta: any, callbackId: string, targets?: string[], mirror?: boolean}): Command {
        const res = new Command();
        res.setup({fromApp: undefined, command: obj.command, meta: obj.meta, callbackId: obj.callbackId, info: { targets: obj.targets, mirror: obj.mirror }})
        return res;
    }

    send() {
        return {command: this.command, meta: this.meta, callbackId: this.callbackId};
    }
}

export class Error {
    code: number;
    message: string;

    constructor(code: number, message: string) {
        this.code = code;
        this.message = message;
    }

    send() {
        return JSON.stringify({type: "error", payload: {code: this.code, message: this.message}});
    }
}

export class Com {
    type: string;
    payload: Payload;

    static typeMap: {[key: string]: typeof Payload} = {
        "command": Command,
        "response": Callback,
        "register": Register,
        "addUser": AddUser,
        "addDevice": AddDevice,
        "registerResponse": GenericResponse
    }

    constructor(type: string, payload: Payload) {
        this.type = type;
        this.payload = payload;
    }

    static error(code: number, message: string): Error {
        return new Error(code, message);
    }

    static command(fromApp: dh.App, command: string, meta: any, callbackId: string, info: {targets?: string[], mirror?: boolean} ): Com {
        return new Com("command", new Command().setup({fromApp, command, meta, callbackId, info}));
    }

    static response(fromApp: dh.App, callbackId: string, meta: any): Com {
        return new Com("response", new Callback().setup({fromApp, callbackId, meta}));
    }

    static register(gToken: string, devName: string, appName: string) {
        return new Com("register", new Register().setup({gToken, devName, appName}));
    }

    static genericResponse(type: string, state: boolean, message: string) {
        return new Com(type, new GenericResponse().setup({state, message}));
    }

    static fromJsonStr(obj: string): Com | Error | false{
        let object: {type: string, payload: any} = JSON.parse(obj);
        let type = object.type;
        if (["register", "addUser", "addDevice"].indexOf(type) < 0) {
            return false;
        }
        try{
            let payload = new Com.typeMap[type]().setup(object.payload);
            return new Com(type, payload);
        } catch(err) {
            return new Error(501, err.toString());
        }
        
    }

    send() {
        return JSON.stringify({type: this.type, payload: this.payload.send()});
    }
}