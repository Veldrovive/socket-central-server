const Client = require("./client");

const url = "ws://localhost:8000";
const userName = "client-test-user";
const userFullName = "Client User";
const userToken = "test-token";
const deviceName = "client-test-device";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createClient(clientNum, softfail=false) {
    const clientOneParams = {url, userToken, deviceName, appName: "client-test-1"};
    const clientTwoParams = {url, userToken, deviceName, appName: "client-test-2"};
    const clientThreeParams = {url, userToken, deviceName, appName: "client-test-3"};
    const params = [clientOneParams, clientTwoParams, clientThreeParams];
    let client;
    try {
        client = await Client.setup(params[clientNum-1]);
    } catch(err) {
        console.log(`Client ${clientNum} failed to register due to`, err);
        if (softfail) {
            return false;
        }
        process.exit();
    }
    console.log(`Client ${clientNum} successfully registered`);
    return client;
}

async function setupTestUser() {
    try {
        const token = await Client.addUser(url, userName, userFullName, userToken);
    } catch(err) {
        console.log("Could not add user: ", err);
    }

    try {
        const devName = await Client.addDevice(url, userToken, deviceName);
    } catch(err) {
        console.log("Could not add device: ", err);
    }
}

async function runTests() {
    console.log("Starting user setup\n");
    await setupTestUser();

    console.log("\n-------------------")
    console.log("Starting Basic Call and Response Tests \n");

    let clientOne = await createClient(1);
    let clientTwo = await createClient(2);
    clientTwo.on("Client Test Command", meta => {
        console.log("Test Client Command Recieved by 2 Had Meta: ", meta)
        return "This is a test Response from client 2";
    });
    let clientThree = await createClient(3);
    clientThree.on("Client Test Command", meta => {
        console.log("Test Client Command Recieved by 3 Had Meta: ", meta)
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve("This is a delayed test Response from client 3")
            }, 1000)
        })
    });

    clientOne.send("Client Test Command", "Only client 2 should get this", ["client-test-2"], data => console.log("Client One Got Response: ", data));
    console.log("Sent command to only 2");

    clientOne.send("Client Test Command", "Both Should get this", data => console.log("Client One Got Response: ", data));
    console.log("Sent command to all");

    await sleep(1500);
    clientOne.disconnect();
    clientTwo.disconnect();
    clientThree.disconnect();
    await sleep (500);
    console.log("\n-------------------")
    console.log("Starting once function test\n");

    clientOne = await createClient(1);
    clientTwo = await createClient(2);
    clientTwo.once("Client Test Command", meta => {
        console.log("Test Client Command Recieved by 2 Had Meta: ", meta)
        return "This is a test Response from client 2";
    });

    clientOne.send("Client Test Command", "This is the first sending", ["client-test-2"], data => console.log("Client One Got Response: ", data));
    console.log("Sent command one");
    clientOne.send("Client Test Command", "This is the second sending", ["client-test-2"], data => console.log("Client One Got Response: ", data));
    console.log("Sent command two");

    await sleep(500);
    clientOne.disconnect();
    clientTwo.disconnect();
    await sleep (500);
    console.log("\n-------------------")
    console.log("Starting mirror test\n");

    clientOne = await createClient(1);

    clientOne.on("Client Test Command", meta => {
        console.log("Mirror command recieved with meta: ", meta);
        return "Mirror response data";
    })
    clientOne.send("Client Test Command", "This is test meta", true, data => console.log("Mirror response callback recieved: ", data));
    await sleep(500);
    clientOne.disconnect();
    await sleep(500);

    // const failedClient = await Client.setup(clientOneParams);
    // console.log("Failed Client is: ", failedClient);


}

runTests();