const { Client } = require('pg');

const client = new Client(
 // user: 'postgres',
 // password: 'postgres',
 // host: '52.13.38.2103',
 // database: 'postgres',
 // port: 5432,
 'postgres://postgres:postgres@54.184.248.161:5432/postgres'
);

client.connect((err) => {
  if (err) {
    console.error('connection error: ', err.stack);
  } else {
    console.log('connected to postgres database')
  }
});

module.exports = client;
