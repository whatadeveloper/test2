const express = require("express");
const bodyParser = require("body-parser");
const app = require("express")();
const server = require("http").createServer(app);
const fs = require("fs");
const qrcode = require("qrcode");
const axios = require("axios");
const mkEvents = require('./events')
const port = process.env.PORT || 7001;
const {
    WAConnection,
    MessageType,
    Presence,
    MessageOptions,
    Mimetype,
    WALocationMessage,
    WA_MESSAGE_STUB_TYPES,
    ReconnectMode,
    ProxyAgent,
    waChatKey,
} = require("@adiwajshing/baileys");

const username = 'Cool';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const patchpanel = new Map()

const conn = new WAConnection();
conn.browserDescription = ['Affiliaters.in', 'Chrome', '87']

conn.version = [2, 2121, 7]

conn.autoReconnect = ReconnectMode.onConnectionLost;

async function connect() {
    fs.existsSync("./auth_info/"+username+".json") && conn.loadAuthInfo("./auth_info/"+username+".json");
    const sharedstate = {}
    sharedstate.conn = conn

    const events = mkEvents({ number:username, sharedstate })
    conn.on('blocklist-update', events.blocklistUpdate)
    conn.on('chat-new', events.chatNew)
    conn.on('chats-received', events.chatsReceived)
    conn.on('chat-update', events.chatUpdate)
    conn.on('close', events.close)
    conn.on('connecting', events.connecting)
    conn.on('connection-phone-change', events.connectionPhoneChange)
    conn.on('connection-validated', events.connectionValidated)
    conn.on('contacts-received', events.contactsReceived)
    conn.on('contact-update', events.contactUpdate)
    conn.on('credentials-updated', events.credentialsUpdated)
    conn.on('group-participants-update', events.groupParticipantsUpdate)
    conn.on('group-update', events.groupUpdate)
    conn.on('message-status-update', events.messageStatusUpdate)
    conn.on('open', events.open)
    conn.on('qr', events.qr)
    conn.on('received-pong', events.receivedPong)
    conn.on('ws-close', events.wsClose)

    await conn.connect({ timeoutMs: 30 * 1000 });
    patchpanel.set(username, { conn, sharedstate })
    console.log("oh hello " + conn.user.name + " (" + conn.user.jid + ")");
}

connect().catch((err) => {
    console.log(err);
});


conn.on("close", async({ reason, isReconnecting }) => {
    console.log(
        "Disconnected because " + reason + ", reconnecting: " + isReconnecting
    );
    if (!isReconnecting) {
        if (fs.existsSync("./auth_info/"+username+".json")) {
            fs.unlinkSync("./auth_info/"+username+".json");
        }
        conn.clearAuthInfo();
        await conn.connect({ timeoutMs: 30 * 1000 });
    }
});

conn.on("contacts-received", () => {
    console.log(`credentials updated`);
    const authInfo = conn.base64EncodedAuthInfo();
    fs.writeFileSync("./auth_info/"+username+".json", JSON.stringify(authInfo, null, "\t"));
    console.log('Saved to json file')
});

let lastqr;
conn.on('qr', qr => {
    qrcode.toDataURL(qr, (err, url) => {
        lastqr = url;
    });
});
app.get("/lastqr", (req, res) => {
    res.status(200).json({ lastqr })
});

app.get("/login", (req, res) => {
    if (fs.existsSync("./auth_info/"+username+".json")){
        res.send("loggedin");
    } else {
        res.status(200).json({ lastqr })
    }
});

app.get("/qr", (req, res) => {
    if (
        fs.existsSync("./auth_info/"+username+".json") &&
        conn.loadAuthInfo("./auth_info/"+username+".json")
    ) {
        res.send("Session Exist");
    } else {
        
    }
});

app.post("/send-message", (req, res) => {
    let phone = req.body.number;
    let message = req.body.message;
    if (phone == undefined || message == undefined) {
        res.send({
            status: "error",
            message: "please enter valid phone and message",
        });
        console.log("number and message undefined");
    } else {
        try {
            conn.sendMessage(phone, message, MessageType.text)
            console.log(`Message successfully sent to ${phone}`);
        } catch (error) {
          console.log(error);
        }
    }
});

app.post("/send-image", (req, res) => {
    let phone = req.body.number;
    let message = req.body.message;
    let imageurl = req.body.imageurl;
    if (phone == undefined || message == undefined) {
        res.send({
            status: "error",
            message: "please enter valid phone and message",
        });
        console.log("number and message undefined");
    } else {
        var Data = imageurl;
        conn.sendMessage(
            phone, 
            { url: Data }, // send directly from remote url!
            MessageType.image, 
            { mimetype: Mimetype.png, filename: "affiliaters.png",caption: message }
        ).then(response => {
            res.send({
                status: "success",
                message: "Message successfully sent to " + phone,
            });
        }).catch((error) => console.log(error))
    }
});


app.post("/send-message-bulk", (req, res) => {
        try{
            let message = req.body.message;
            req.body.allgroups.forEach(function(group) {
                conn.sendMessage(
                    group, 
                    message, // send directly from remote url!
                    MessageType.text
                ).catch((error) => {
                    console.log(error)
                });
            })
            console.log('Message Sending Complete in '+ req.body.allgroups.length)
        } catch (error) {
          console.log(error);
        } 
});

app.post("/send-image-bulk", (req, res) => {
    try{
        let message = req.body.message;
        axios({
            method: "get",
            url: req.body.imageurl,
            responseType: "arraybuffer"
        }).then(function (response) {
            var Data = response.data;
            req.body.allgroups.forEach(function(group) {
                conn.sendMessage(
                    group, 
                    Data, // send directly from remote url!
                    MessageType.image, 
                    { mimetype: Mimetype.png, filename: "affiliaters.png",caption: message }
                ).catch((error) => {
                    console.log(error)
                });
            })
        }).catch((error) => {
            console.log(error)
        });
        console.log('Image Sending Complete')
    } catch (error) {
      console.log(error);
    } 
});

app.get("/affiliaters", (req, res) => {
    const options = {
        files: 'node_modules/@adiwajshing/baileys/lib/WAConnection/Utils.js',
        from: "baileys: browser => ['Baileys', browser,",
        to: "baileys: browser => ['Affiliaters', browser,",
    };
    replace(options)
        .then(results => {
            console.log('Replacement results:', results);
        })
        .catch(error => {
            console.log('Error occurred:', error);
        });
});

app.get("/get-chats", async (req, res) => {
    var unread = await conn.loadChats();
    let uu = unread.chats;
    let extractedValue = uu.filter(function(item) {
        if (item['jid'].includes('@g.us'))
            return { groupid: item['jid'], groupname: item['name'], groupimg: item['imgUrl'] }
    }).map(function(item) {
        if (item['jid'].includes('@g.us'))
            return { groupid: item['jid'], groupname: item['name'], groupimg: item['imgUrl'] }
    });
    res.send({ status: "success", message: extractedValue });
});

server.listen(port, () => {
    console.log("Server Running Live on Port : " + port);
}); 
