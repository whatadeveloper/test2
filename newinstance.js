const fs = require('fs')
const fetch = require('node-fetch')
const qrcode = require("qrcode")
const axios = require('axios');
const { WAConnection } = require('@adiwajshing/baileys')

const newinstance = async ({ webhook }) => {
  const WAC = new WAConnection()
  WAC.browserDescription = ['Affiliaters.in', 'Chrome', '87']
  let attempts = 0
  let lastqr = 0

  WAC.on('qr', qr => {
    if (fs.existsSync(`auth_info/${webhook}.json`)) {
      try{
        WAC.close()
      } catch (err){
        console.log(err);
      }
    } else {
      attempts += 1
      qrcode.toDataURL(qr, (err, url) => {
          lastqr = url;
      });
      fs.writeFileSync(`qr/${webhook}.json`, JSON.stringify({ type: 'qr', qr: lastqr, attempts, webhook  }, null, "\t"));
      // fetch(webhook, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({ type: 'qr', qr, attempts })
      // }).catch(() => {})
    }
  })

  WAC.on('blocklist-update', () => {
    console.log('blocklist-update')
    fs.writeFileSync(`auth_info/${webhook}.json`, JSON.stringify(WAC.base64EncodedAuthInfo(), null, 2))
    try{
      fs.unlinkSync(`qr/${webhook}.json`);
    } catch (err){
      console.log(err);
    }
    setTimeout(function() {
      try{
        axios.get('http://localhost:3000/' + webhook +'/up')
        console.log('get done')
      } catch (err){
        console.log(err);
      }
    }, 5000);
  })

  // WAC.on('received-pong', () => {
  //   console.log('received-pong')
  //   WAC.close()
  // })
  WAC.connect()
}

module.exports = newinstance
