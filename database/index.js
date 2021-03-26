const { Client } = require('pg');

const client = new Client({
  host: '54.184.248.161',
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
  port: 5432,
  max: 20,
});

// 'postgres://postgres:postgres@54.184.248.161:5432/postgres'

client.connect((err) => {
  if (err) {
    console.error('connection error: ', err.stack);
  } else {
    console.log('connected to postgres database pool')
  }
});

module.exports = client;
