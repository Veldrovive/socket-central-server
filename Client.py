import socketio

class Client:
        connected = False
        registered = False
        sio = None
        commandMap = {}
        url = ""
        name = ""

        def __init__(self, name, url, log=False):
                self.name = name
                self.url = url
                self.log = log
                self.sio = socketio.Client()
                self.start()

        def start(self):
                print("Connecting to {}".format(self.url))
                self.addBasicEvents()
                self.sio.connect(self.url)

        def addBasicEvents(self):
                @self.sio.event
                def connect():
                    print("I'm connected!")
                    self.connected = True
                    def onRegistered(data):
                        if data["success"] == True:
                                print("Registered")
                                self.registered = True
                        else:
                                print("Failed to Register")
                    self.sio.emit('register', {'name': self.name}, callback=onRegistered)

                @self.sio.event
                def disconnect():
                    print("I'm disconnected!")

                @self.sio.event
                def command(data):
                    command = data["command"]
                    meta = data["meta"]
                    if(command in self.commandMap):
                            self.commandMap[command](meta)

        def getId(self, appName=None, callback=None):
                if appName is None:
                        appName = self.name
                self.sio.emit('get_id', {'appName': appName}, callback=callback)

        def getClients(self, callback=None):
                self.sio.emit('get_clients', callback=callback)

        def getPastCommands(self, callback=None):
                self.sio.emit('get_past_commands', callback=callback)

        def on(self, command, callback):
                self.commandMap[command] = callback

        def send(self, command, meta=None, target=None, mirror=False):
                self.sio.emit('command', {'command': command, 'meta': meta, 'target': target, 'mirror': mirror})