const express = require("express");
const bodyParser = require("body-parser");
const app = require("express")();
const server = require("http").createServer(app);
const fs = require("fs");
const qrcode = require("qrcode");
const axios = require("axios");
const mkEvents = require('./events')
const port = process.env.PORT || 5162;
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const patchpanel = new Map()

const conn = new WAConnection();
conn.browserDescription = ['Affiliaters.in', 'Chrome', '87']
conn.autoReconnect = ReconnectMode.onConnectionLost;
// conn.connectOptions = { reconnectID: "reconnect" };

async function connect() {
    fs.existsSync("./auth_info/govind.json") && conn.loadAuthInfo("./auth_info/govind.json");
    const sharedstate = {}
    sharedstate.conn = conn

    const events = mkEvents({ number:'govind', sharedstate })
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
    patchpanel.set('govind', { conn, sharedstate })
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
        if (fs.existsSync("./auth_info/govind.json")) {
            fs.unlinkSync("./auth_info/govind.json");
        }
        conn.clearAuthInfo();
        await conn.connect({ timeoutMs: 30 * 1000 });
    }
});

conn.on("credentials-updated", () => {
    // save credentials whenever updated
    console.log(`credentials updated`);
    const authInfo = conn.base64EncodedAuthInfo(); // get all the auth info we need to restore this session
    fs.writeFileSync("./auth_info/govind.json", JSON.stringify(authInfo, null, "\t")); // save this info to a file
    console.log('Saved to json file')
});

let lastqr;
conn.on('qr', qr => {
    qrcode.toDataURL(qr, (err, url) => {
        // console.log(qr);
        lastqr = url;
    });
    // lastqr = qr
});
app.get("/lastqr", (req, res) => {
    // console.log(lastqr);
    res.status(200).json({ lastqr })
});

app.get("/login", (req, res) => {
    if (fs.existsSync("./auth_info/govind.json")){
        res.send("loggedin");
    } else {
        res.status(200).json({ lastqr })
    }
});

app.get("/qr", (req, res) => {
    if (
        fs.existsSync("./auth_info/govind.json") &&
        conn.loadAuthInfo("./auth_info/govind.json")
    ) {
        res.send("Session Exist");
    } else {
        var page = `<html><head></head><body> <img src="" alt="Loading Please Wait" id="qrcode"></body> <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.5.1/jquery.min.js" integrity="sha512-bLT0Qm9VnAYZDflyKcBaQ2gg0hSYNQrJ8RilYldYQ1FxQYoCLtUjuuRuZo+fjqhx/qtq/1itJ0C2ejDxltZVFg==" crossorigin="anonymous"></script> <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/3.0.1/socket.io.js" integrity="sha512-vGcPDqyonHb0c11UofnOKdSAt5zYRpKI4ow+v6hat4i96b7nHSn8PQyk0sT5L9RECyksp+SztCPP6bqeeGaRKg==" crossorigin="anonymous"></script> <script>$(document).ready(function(){var socket=io.connect({'transports':['websocket']});socket.on('qr',function(msg){$('#qrcode').attr('src',msg);});});</script> </html>`;
        res.write(page);
        res.end();
    }
});

app.post("/send-message", (req, res) => {
    let phone = req.body.number;
    let message = req.body.message;
    // let firstnumber = phone.substr(0, 1);
    //   console.log(firstnumber);
    if (phone == undefined || message == undefined) {
        res.send({
            status: "error",
            message: "please enter valid phone and message",
        });
        console.log("number and message undefined");
    } else {
        // if (firstnumber == "8") {
        //   phone = "62".concat(phone);
        // } else if (firstnumber == "0") {
        //   phone = phone.replace("0", "62");
        // }
        // conn.isOnWhatsApp(phone).then((is) => {
        //     if (is) {
        conn
            .sendMessage(phone, message, MessageType.text)
            .then((response) => {
                res.send({
                    status: "success",
                    message: "Message successfully sent to " + phone,
                });
                console.log(`Message successfully sent to ${phone}`);
            });
        // else {
        //     res.send({
        //         status: "error",
        //         message: phone + " is not a whatsapp user",
        //     });
        //     console.log(`${phone} is not a whatsapp number`);
        // }
        // });
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
            console.error('Error occurred:', error);
        });
});

app.get("/get-chats", (req, res) => {
    conn
        .loadChats()
        .then((unread) => {
            let uu = unread.chats;
            let extractedValue = uu.filter(function(item) {
                if (item['jid'].includes('@g.us'))
                    return { groupid: item['jid'], groupname: item['name'], groupimg: item['imgUrl'] }
            }).map(function(item) {
                if (item['jid'].includes('@g.us'))
                    return { groupid: item['jid'], groupname: item['name'], groupimg: item['imgUrl'] }
            });
            res.send({ status: "success", message: extractedValue });
        })
        .catch(() => {
            res.send({ status: "error", message: "getchatserror" });
        });
    // const unread = await conn.loadAllUnreadMessages ()
    //       console.log ("you have " + unread.length + " unread messages")

    // const chats = conn.getChats()
    // if (cursor) {
    //     const moreChats = conn.loadChats (20, cursor) // load the next 25 chats
    // }
    // console.log(cursor)
    // console.log(chats)
    // res.send({ status: "success", message: chats });
    // conn
    //   .getChats()
    //   .then((chats) => {
    //     // console.log(chats);
    //     res.send({ status: "success", message: chats });
    //   })
    //   .catch(() => {
    //     res.send({ status: "error", message: "getchatserror" });
    //   });
});

server.listen(port, () => {
    console.log("Server Running Live on Port : " + port);
}); 