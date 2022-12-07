const express = require('express');
const http = require('http');
const https = require('https');
const socketio = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server= http.createServer(app);
const io = new socketio.Server();
const port = process.env.PORT || 3000;

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.use(express.static(path.join(__dirname, "..", "..", "public")));

io.attach(server, {
    //path: '/socket',
    cors: { origin: '*' },
    //upgrade: false,
    //transports: ['websocket']
});

//

class Player {
    id = ""
    name = "Player"
    position = {x: 0, y: 0, z: 0}
    rotation = {pitch: 0, roll: 0, yaw: 0}
    socket = undefined

    recordingData = false
    recordedData = [];

    playingRecordedData = false;
    playingRecordedIndex = 0;

    constructor()
    {
        setInterval(() => {
            
            if(this.playingRecordedData)
            {
                this.playingRecordedIndex += 3;
                if(this.playingRecordedIndex >= this.recordedData.length) this.playingRecordedIndex = 0;

                
                var frame = this.recordedData[this.playingRecordedIndex];
                //console.log(this.playingRecordedIndex, frame)

                this.position = frame.position;
                this.rotation = frame.rotation;

                sendPlayerData(this)
            }

        }, 100);
    }

    send(key, data)
    {
        if(!this.socket) return;
        if(!this.socket.connected) return;

        //console.log(`sending ${key} to ${this.id}`)

        this.socket.emit(key, data);
    }
}

class GameObject {
    id = 0
    position = {x: 0, y: 0, z: 0}
}

class WorldText {
    id = 0
    position = {x: 0, y: 0, z: 0}
}

const players = [];
const objects = [];
const worldTexts = [];

//

function sendPlayerData(player, toPlayer)
{
    if(!toPlayer)
    {
        for(const p of players)
        {
            sendPlayerData(player, p)
        }
        return;
    }

    const data = {
        id: player.id,
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        rp: player.rotation.pitch,
        rr: player.rotation.roll,
        ry: player.rotation.yaw,
    };

    if(toPlayer == player)
    {
        data.x += 200;
        return;
    }

    toPlayer.send("playerData", JSON.stringify(data));
}

function sendObjectData(object, toPlayer)
{
    if(!toPlayer)
    {
        for(const p of players)
        {
            sendObjectData(object, p)
        }
        return;
    }

    toPlayer.send("objectData", JSON.stringify({
        id: object.id,
        x: object.position.x,
        y: object.position.y,
        z: object.position.z
    }));
}

function sendTp(player, position)
{
    console.log("tp ", position)

    player.send("tp", JSON.stringify({
        x: position.x,
        y: position.y,
        z: position.z
    }));
}

function loadData()
{
    if(!fs.existsSync("players.json")) return;

    const json = JSON.parse(fs.readFileSync("players.json", 'utf-8'));

    for(const jsonPlayer of json.players)
    {
        const player = new Player();
        player.id = jsonPlayer.id;
        player.name = jsonPlayer.name;
        player.rotation = jsonPlayer.rotation;
        player.position = jsonPlayer.position;
        players.push(player);
    }

    console.log(json)
}

function saveData()
{
    const json = {
        players: [],
        objects: []
    }

    for(const player of players)
    {
        json.players.push({
            id: player.id,
            name: player.name,
            rotation: player.rotation,
            position: player.position
        })
    }

    fs.writeFileSync("players.json", JSON.stringify(json), 'utf-8');

    console.log(`saving`)
}

const npc = new Player();

function main()
{
    //loadData();
}

function spawnNpc(id, position)
{
    const npc = new Player();
    npc.id = id;
    npc.position = position;
    players.push(npc)

    console.log(position)

    sendPlayerData(npc);

    return npc;
}

function processPlayerMessage(player, message)
{
    console.log(`processPlayerMessage ${message} from ${player.id}`)

    //spawnWorldText(message, player.position)

    if(message.startsWith("/"))
    {
        var args = message.split(" ");
        var argStr = (index) => {
            var str = "";
            for (let i = 0; i < args.length; i++)
            {
                str += args[i];
                if(i != args.length - 1) str += " ";
            }
            return str;
        }
        var cmd = args.shift().replace("/", "");

        if(cmd.toLowerCase().includes("recordnpc"))
        {
            if(!player.recordingData)
            {
                player.recordingData = true;
                player.recordedData = []

                sendMessage("[:]", `Recording`)
            } else {
                player.recordingData = false;
                const npc = spawnNpc(`NPC_${players.length}`, player.position);
                npc.recordedData = JSON.parse(JSON.stringify(player.recordedData));
                npc.playingRecordedData = true;

                sendMessage("[:]", `Finished recording`)
            }

            //spawnNpc(`NPC_${players.length}`, player.position);

            return;
        }

        if(cmd.toLowerCase().includes("text"))
        {
            if(args.length == 0)
            {
                sendMessage("[:]", `Type: /text [text]`)
                return;
            }

            spawnWorldText(argStr(0), player.position)

            sendMessage("[:]", `Text created`)

            return
        }

        if(cmd.toLowerCase().includes("pos"))
        {
            
            var position = player.position;

            sendMessage("[:]", `Position: ${position.x}, ${position.y}, ${position.z}`)

            return
        }
        
        if(cmd.toLowerCase().includes("tp"))
        {
            console.log(args)

            if(args.length < 3)
            {
                sendMessage("[:]", `Type: /tp [x] [y] [z]`)
                return;
            }

            var position = {x: parseFloat(args[0]), y: parseFloat(args[1]), z: parseFloat(args[2])};

            sendTp(player, position);

            sendMessage("[:]", `Teleported to ${position.x}, ${position.y}, ${position.z}`)

            return;
        }

        if(cmd.toLowerCase().includes("spawnobj"))
        {
            if(args.length == 0)
            {
                sendMessage("[:]", `Type: /spawnobj [id]`)
                sendMessage("[:]", `IDS: 1 to 4`)
                return;
            }

            var id = parseInt(args[0]);

            var pos = Object.assign({}, player.position);
            pos.z -= 50

            spawnObject(id, pos)
            sendMessage("[:]", `Object ID '${id}' spawned`)

            return;
        }

        console.log(cmd, args)

        sendMessage("[:]", `Invalid command '/${cmd}', type /help`)
        return;
    }

    sendMessage(player.id, message)
}

function sendMessage(tag, message, toPlayer)
{
    if(!toPlayer)
    {
        for(const p of players)
        {
            sendMessage(tag, message, p)
        }
        return;
    }

    toPlayer.send("message", JSON.stringify({
        tag: tag,
        text: message
    }));
}

function spawnObject(id, position)
{
    const object = new GameObject();
    object.id = id;
    object.position.x = position.x;
    object.position.y = position.y;
    object.position.z = position.z;
    objects.push(object);

    sendObjectData(object)
}

function spawnWorldText(text, position)
{
    for(const toPlayer of players)
    {
        toPlayer.send("spawnWorldText", JSON.stringify({
            text: text,
            x: position.x,
            y: position.y,
            z: position.z
        }));
    }
}

io.on('connection', function (socket) {   
    const id = socket.id;
    const ip = socket.handshake.address;

    console.log(`[app] ${id} new connection`);

    const player = new Player();
    player.socket = socket;
    player.id = id;
    players.push(player)

    //processPlayerMessage(player, "/")

    socket.on("clientPlayerData", (datastr) => {
        const data = JSON.parse(datastr);

        player.position.x = data.x;
        player.position.y = data.y;
        player.position.z = data.z;

        player.rotation.pitch = data.rp;
        player.rotation.roll = data.rr;
        player.rotation.yaw = data.ry;

        if(player.recordingData)
        {
            if(player.recordedData.length < 2000)
            {
                player.recordedData.push(JSON.parse(JSON.stringify({position: player.position, rotation: player.rotation})))

            }

            console.log(player.recordedData.length + " frames")
        }

        sendPlayerData(player);
    })

    socket.on("clientMessage", (text) => {

        processPlayerMessage(player, text)

    });

    socket.on('disconnect', function (data) {
        console.log(`[app] ${id} disconnected at ${player.position.x} ${player.position.y} ${player.position.z}`);

        sendMessage("Server", `${player.id} left`)
    });

    socket.on('clientSpawnActor', function (datastr) {
        const data = JSON.parse(datastr);
        
        console.log(`clientSpawnActor`, datastr);

    });

    console.log(players.length + " players")

    for(const object of objects)
    {
        sendObjectData(object, player)
    }

    sendPlayerData(player);
    saveData();
    sendMessage("Server", `${player.id} joined`)
    sendMessage("Server", `Type '/help' for a list of commands`, player)
});

server.listen(port, "0.0.0.0", () => {
    console.log(`Express web server started: http://localhost:${port}`)
});
