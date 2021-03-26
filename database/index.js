const { Client } = require('pg');

const client = new Client({
  host: '172.31.36.16',
  user: 'postgres',
  password: 'kK9wI4oK1eH2nR3tN3qK2nS3cS9tN5wE',
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
