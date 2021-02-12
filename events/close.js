const fs = require('fs')
const axios = require('axios');
const newinstance = require('../newinstance')

const mkClose = ({ number, sharedstate }) => async (...args) => {
  console.log(`${number} close`)
  try{
    axios.get('http://localhost:3000/' + number +'/down')
    axios.get('http://localhost:3000/' + number +'/login')
    fs.unlinkSync(`auth_info/${number}.json`);
  } catch (err){
    console.log(err);
  }
}

module.exports = mkClose
