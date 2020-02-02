# Socket Server
This uses the socket.io system to connect a network of clients into one web so that any apps that they are running can communicate with one another.

### Theory:
To start, a client must register with the server with an app name. This allows the server to keep track of who is connecting and when.
Once a client is connected, it has five actions it can take:
1. `get_id` - Returns the current client's unique identifier that is stored in the list of registered clients.
2. `get_clients` - Returns a list of registered clients with each `id`, `connection status`, and `last connection time`.
3. `get_past_commands` - Returns a list of the past commands that have been issued by all clients.
4. `command` - Issues a command that will be broadcast to a specific target or all registered clients.
5. `disconnect` - Soft disconnects the client.

### Clients:
**Setup**:

*javascript* - A client object is create by passing a name and server url. Callbacks for onConnected and onDisconnected are also provided as optional parameters. The user must then call the `connect` function to start.

*python* - A name and server url are the only parameters. No `connect` call is needed.

**Sending Commands**:

In order to send a command, the user calls to the `send` function. It takes one required parameter and three optional ones.
1. `name` - The command identifier. This is what other clients hook into to react to commands.
2. `meta` - If the command requires parameters, they are passed through the `meta` argument.
3. `target` - If `None` then the command is broadcast to all clients. If a value is set to an array, the command is only broadcast to clients registered with a name in the array.
4. `mirror` - If this is `true` then the command will be sent back to the sender as well as all other clients.

**Receiving Commands**:

In order to hook into commands, the user calls the `on` function which creates a callback that is executed every time a specific command is received. It takes two arguments, a command name and a callback.
1. `command` - The command name. When a client sends a command with the cooresponding name, the callback will run.
2. `callback` - The function that will run when a client sends the command. The meta will be passed as arguments into the function.

**Other Functions**:

All of these functions take an extra parameter in *python* for a callback.
* `getId` - Takes an appname and return the unique id of the app.
* `getClients` - Returns a list of all connected clients.
* `getPastCommands` - Returns a list of past commands that the server has passed.
