const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const ACTIONS = require('./Actions');
const server = http.createServer(app)
const io = new Server(server);
var cors = require('cors')


const compiler = require("compilex");
const { log } = require('console');
const options = { stats: true };
compiler.init(options);

app.use(express.json());
app.use(cors())

// map all the joined user's socket id with username in this userSocketMap object
const userSocketMap = {}

function getAllConnectedClients(roomId) {
    // return all list of clients connected in a room (in array format so use array.from to convert it to array)
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
        return {
            socketId,
            username: userSocketMap[socketId],
        }
    })
}

io.on('connection', (socket) => {
    // console.log('socket connected', socket.id);

    // get the parameter sent from EditorPage.js
    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        // if first time creating room 
        socket.join(roomId);
        // if already some user are availabe in the room then get list of clients connected in the room
        const clients = getAllConnectedClients(roomId);
        // console.log(clients); //log in terminal -> all the clients connected in a room 

        // send this information to frontend(EditorPage.js) to update the ui of editor page
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id
            })
        })
    })



    // for code change on all rooms 
    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });//sending to client the code received on server and used socket.in because we have to brodcast all the code to other users not to myself that's why io.to was working incorrectly
    });


    // for code sync on all rooms 
    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });//sending code to only client who is just joined the room because the user wants the previous written code that's why doing this
    });



    // for disonnection
    socket.on('disconnecting', () => {
        // get all socket rooms
        const rooms = [...socket.rooms]; //you can you Array.from also to convert it to an array or also this syntax is correct (spread method)
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            })
        })
        // delete from map
        delete userSocketMap[socket.id];
        socket.leave(); //leave the room
    })
})





app.get("/test" , (req,res) => {
    res.json("success");
})
// compiler.flush(function(){
//     console.log("deleted");
// })
app.post("/runcode", function (req, res) {
    var code = req.body.code;
    var input = req.body.Input;
    var lang = req.body.lang; // Adjusted to match the expected field name in editor.js
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
            var envData = { OS: "windows" }; // Modify environment data as needed
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

    // res.status(202).json({
    //     output : "success",
    // });
    

});






const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));