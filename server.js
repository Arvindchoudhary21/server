const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');
const server = http.createServer(app)
const io = new Server(server);
var cors = require('cors')

const compiler = require("compilex");
const options = { stats: true };
compiler.init(options);

app.use(express.json());
app.use(cors())

const userSocketMap = {}

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
        return {
            socketId,
            username: userSocketMap[socketId],
        }
    })
}

io.on('connection', (socket) => {
    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);

        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id
            })
        })
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.CURSOR_CHANGE, ({ roomId, cursor }) => {
        socket.in(roomId).emit(ACTIONS.CURSOR_CHANGE, {
            socketId: socket.id,
            cursor,
        });
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            })
        })
        delete userSocketMap[socket.id];
        socket.leave();
    })
});

app.get("/test" , (req,res) => {
    res.json("success");
})

app.post("/runcode", function (req, res) {
    var code = req.body.code;
    var input = req.body.Input;
    var lang = req.body.lang;
    console.log(lang);
    try {
        if (lang == "java") {
            var envData = { OS: "windows" };
            if (input) {
                compiler.compileJavaWithInput(envData, code, input, handleResponse);
            } else {
                compiler.compileJava(envData, code, handleResponse);
            }
        } else if (lang == "python") {
            var envData = { OS: "windows" };
            if (input) {
                compiler.compilePythonWithInput(envData, code, input, handleResponse);
            } else {
                compiler.compilePython(envData, code, handleResponse);
            }
        }else if (lang == "cplusplus") {
            var envData = { OS: "windows", cmd: "g++", options: { timeout: 10000 } };
            if (input) {
                compiler.compileCPPWithInput(envData, code, input, handleResponse);
            } else {
                compiler.compileCPP(envData, code, handleResponse);
            }
        }
         else {
            throw new Error("Unsupported language");
        }
    }
     catch (e) {
        console.log("error:", e);
        res.status(400).send({ output: "Error: " + e.message });
    }

    function handleResponse(data) {
        if (data.output) {
            res.status(200).send(data);
        } else {
            res.status(400).send({ output: "Error: Execution failed" });
        }
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
