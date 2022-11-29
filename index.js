const express = require('express');
const http = require('http');
const https = require('https');
const socketio = require('socket.io');
const path = require('path');

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

class Player {
    id = ""
    position = {x: 0, y: 0, z: 0}
    rotation = {pitch: 0, roll: 0, yaw: 0}
}

const players = [];

io.attach(server, {
    //path: '/socket',
    cors: { origin: '*' },
    //upgrade: false,
    //transports: ['websocket']
});

io.on('connection', function (socket) {   
    const id = socket.id;
    const ip = socket.handshake.address;

    console.log(`[app] ${id} new connection from ${ip}`);

    const player = new Player();
    player.id = id;
    players.push(player)

    console.log(players.length + " players")

    setInterval(() => {
        for(const p of players)
        {
            if(p == player) continue;

            if(socket.connected)
            {
                const position = {x: p.position.x, y: p.position.y, z: p.position.z}

                if(p == player)
                {
                    position.x += 300;
                }

                socket.emit("playerData", JSON.stringify({
                    id: p.id,
                    x: position.x,
                    y: position.y,
                    z: position.z,
                    rp: p.rotation.pitch,
                    rr: p.rotation.roll,
                    ry: p.rotation.yaw,
                }));
            }
        }
    }, 100);

    socket.on("clientPlayerData", (datastr) => {
        
        const data = JSON.parse(datastr);

        player.position.x = data.x;
        player.position.y = data.y;
        player.position.z = data.z;

        player.rotation.pitch = data.rp;
        player.rotation.roll = data.rr;
        player.rotation.yaw = data.ry;
    })

    

    socket.on('disconnect', function (data) {
        console.log(`[app] ${id} disconnected at ${player.position.x} ${player.position.y} ${player.position.z}`);
    });
});

server.listen(port, "0.0.0.0", () => {
    console.log(`Express web server started: http://localhost:${port}`)
});


function fetchBody(url, callback) {
    https.get(url, (resp) => {
        let data = '';
        resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => { callback(data);  });
    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });
}

//---
