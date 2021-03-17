const express = require('express');
const morgan = require('morgan');
const axios = require('axios');
const path = require('path');
const db = require('../database');
const app = express();
const port = 3000;

app.use(morgan('dev'));
app.use(express.json());
// app.use(express.static('public'))

app.get('/', (req, res) => {
  db.query('SELECT NOW() as now', (err, res) => {
    if (err) {
      console.log('error in sample query: ', err.stack);
    } else {
      console.log('sample query fine')
    }
  })
  res.send('Hello World!')
});

app.listen(port, () => {
  console.log(`questions api service listening at http://localhost:${port}`)
})