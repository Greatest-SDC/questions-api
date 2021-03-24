const { Client } = require('pg');

const client = new Client({
  user: 'dantian',
  host: '34.213.179.73',
  database: 'sdc',
  port: 5432,
});

client.connect((err) => {
  if (err) {
    console.error('connection error: ', err.stack);
  } else {
    console.log('connected to postgres database')
  }
});

module.exports = client;