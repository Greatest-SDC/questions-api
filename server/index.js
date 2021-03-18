const express = require('express');
const morgan = require('morgan');
const axios = require('axios');
const path = require('path');
const { reset } = require('nodemon'); // from Ankylosaurus group

const client = require('../database');
const { TOKEN } = require('../config.js');

const app = express();
const port = 3000;

app.use(morgan('dev'));
app.use(express.json());
// app.use(express.static('public')) // ankylosaurus has one a few lines below too

//////////////////////////////
// FROM ANKYLOSAURUS GROUP //
////////////////////////////

// const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
// app.use(express.static(PUBLIC_DIR));

const url = 'https://app-hrsei-api.herokuapp.com/api/fec2/hr-sea/';
            'https://app-hrsei-api.herokuapp.com/api/fec2/hr-sea/products/20113';

app.get('/questions/:params', (req, res) => {
  const { params } = req.params;

  allQuestions(params, (err, data) => {
    if (err) {
      console.log('error in get request to all questions: ', err)
    } else {
      res.send(data);
    }
  })
});

const allQuestions = async (params, callback) => {
  // limit 5 (5 questions * 5 answers each = max 25)
  // select * from questions where product_id = ${params}
  // select * from answers where question_id === results of the question_ids from prev

  //// select questions.*, answers.*, array_agg(url) photos from questions inner join answers on (product_id = '1') left join answer_photos on (answers.answer_id = answer_photos.answer_id) where questions.question_id = answers.question_id group by questions.question_id, answers.answer_id, answers.question_id;

  // select questions.*, answers.*, array_agg(url) photos from questions inner join answers on (product_id = '1') left join answer_photos on (answers.answer_id = answer_photos.answer_id) where questions.question_id = answers.question_id group by questions.question_id, answers.answer_id, answers.question_id;

  // returns an array, so I'll have to iterate through the array

  const queryStr = `select questions.*, answers.*, array_agg(url) photos from questions inner join answers on (product_id = '${params}') left join answer_photos on (answers.answer_id = answer_photos.answer_id) where questions.question_id = answers.question_id group by questions.question_id, answers.answer_id, answers.question_id;`;

  let response;

  try {
    response = await client.query(queryStr);
  } catch(err) {
    console.log('error in querying all question: ', err)
  }

  // construct answers object where the answer for each question is at the key of question_id
  // {questionid: {answerid: {answer stuff}}, questionid: {answerid: {answer stuff}}}
  let answersObj = {}
  const answerObjConstructor = (responseObj) => {
    const rows = responseObj.rows;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (answersObj[row.question_id] === undefined) {
        answersObj[row.question_id] = {};
      }

      if (answersObj[row.question_id][row.answer_id] === undefined) {
        answersObj[row.question_id][row.answer_id] = 1;
      }

      const answerContents = {
        id: row.answer_id,
        body: row.body,
        date: row.date,
        answerer_name: row.answerer_name,
        helpfulness: row.helpfulness,
        photos: row.photos,
      };

      answersObj[rows[i].question_id][rows[i].answer_id] = answerContents;
    }
  }
  answerObjConstructor(response);

  // construct question results with all the questions as results into an array
  let resultsArray = [];
  const resultsArrayConstructor = (responseObj) => {
    const rows = responseObj.rows;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const resultContents = {
        question_id: row.question_id,
        question_body: row.question_body,
        question_date: row.question_date,
        asker_name: row.asker_name,
        question_helpfulness: row.question_helpfulness,
        reported: row.reported,
        answers: answersObj[row.question_id],
      }

      resultsArray.push(resultContents);
    }
  }
  resultsArrayConstructor(response);

  // construct final outermost response wrapper
  let questionsObj = {
    product_id: params,
    results: resultsArray,
  };

  callback(null, questionsObj);
}

// API request to post a new answer to an existing question
app.post('/api/qa/questions/:questionId/answers', (req, res) => {
  const { questionId } = req.params;
  const reqBody = req.body.params;
  // axios.post(`${url}qa/questions/${questionId}/answers`, req.body.params, {
  //   headers: { Authorization: TOKEN },
  // })
  //   .then((response) => {
  //     console.log('server answer submit response');
  //     res.send(201);
  //   })
  //   .catch((err) => {
  //     console.log('server answer submit error', err);
  //     res.sendStatus(500);
  //   });

  postNewAnswer(questionId, reqBody, (err, data) => {
    if (err) {
      console.log('error in post request to add answer: ', err)
    } else {
      res.send(data);
    }
  })

});

const postNewAnswer = async (questionId, answerInfo, callback) => {
  // answerinfo reqbody comes in as
  // params: {
  //   body: answerValue,
  //   name: nickname,
  //   email: emailAnswer,
  //   photos: [],
  // }
  // need current date/time as well inserted as string
  // added autoincrement ('serial'-like) to answer_id column in postgres

  var date = new Date();
  var formattedDate = date.toISOString();

  const queryStr = `insert into answers(question_id, body, date, answerer_name, answerer_email, helpfulness, reported) values (${questionId}, ${answerInfo.body}, ${formattedDate}, ${answerInfo.name}, ${answerInfo.email}, 0, false)`;

  let response;

  try {
    response = await client.query(queryStr);
  } catch(err) {
    console.log('error in post query: ', err);
  }

  callback(null, response);
}

// API request to post a new question
app.post('/api/qa/questions', (req, res) => {
  axios.post(`${url}qa/questions`, req.body, {
    headers: { Authorization: TOKEN },
  })
    .then((response) => {
      console.log('server question submit response');
      res.sendStatus(201);
    })
    .catch((err) => {
      console.log('server question submit error', err);
      res.sendStatus(500);
    });
});

// API request to increment the helpfulness of an answer
app.put('/api/qa/answers/:answerId/helpful', (req, res) => {
  const { answerId } = req.params;
  axios.put(`${url}qa/answers/${answerId}/helpful`, { body: { answer_id: req.body.id } }, {
    headers: { Authorization: TOKEN },
  })
    .then((response) => {
      console.log('server helpfulness put response');
      res.sendStatus(201);
    })
    .catch((err) => {
      console.log('server helpfulness put error', err);
      res.sendStatus(500);
    });
});

// API request to increment the helpfulness of a question
app.put('/api/qa/questions/:questionId/helpful', (req, res) => {
  const { questionId } = req.params;
  axios.put(`${url}qa/questions/${questionId}/helpful`, { body: { question_id: req.body.id } }, {
    headers: { Authorization: TOKEN },
  })
    .then((response) => {
      console.log('server helpfulness question put response');
      res.sendStatus(201);
    })
    .catch((err) => {
      console.log('server helpfulness question put error', err);
      res.sendStatus(500);
    });
});

// API request to report this answer
app.put('/api/qa/answers/:answerId/report', (req, res) => {
  const { answerId } = req.params;
  axios.put(`${url}qa/answers/${answerId}/report`, { body: { answer_id: req.body.id } }, {
    headers: { Authorization: TOKEN },
  })
    .then((response) => {
      console.log('server report put response');
      res.sendStatus(201);
    })
    .catch((err) => {
      console.log('server report put error', err);
      res.sendStatus(500);
    });
});

// sample endpoint to show connection to database
app.get('/', (req, res) => {
  client.query('SELECT NOW() as now', (err, res) => {
    if (err) {
      console.log('error in sample query: ', err.stack);
    } else {
      console.log('sample query fine')
      console.log(res)
    }
  })
  res.send('Hello World!')
});

app.get('/test', (req, res) => {
  const { params } = req.params;
  // refactor into client.query
  // axios.get(`${url}qa/questions/?product_${params}`, {
  //   headers: { Authorization: TOKEN },
  // })
  //   .then((data) => res.send(data.data))
  //   .catch((err) => console.log('error getting questions', err.response.data));
  test(params, (err, data) => {
    res.send(data);
  })

});

const test = async (params, callback) => {
  const queryStr2 = "select * from answers where question_id = '1'";

  await client.query(queryStr2, (err, data) => {
    if (err) {
      console.error('error in querying all questions: ', err)
    } else {
      console.log(data);
      callback(null, data.rows);
    }
  })
}

app.listen(port, () => {
  console.log(`questions api service listening at http://localhost:${port}`)
})

// API request to get the product info
// app.get('/product/:params', (req, res) => {
//   const { params } = req.params;
//   axios.get(`${url}products/${params}`, {
//     headers: { Authorization: TOKEN },
//   })
//     .then((data) => {
//       res.send(data.data);
//     })
//     .catch((err) => console.log('error getting product info', err.response.data));
// });

// // API request to get the styles
// app.get('/styles/:params', (req, res) => {
//   const { params } = req.params;
//   axios.get(`${url}products/${params}/styles`, {
//     headers: { Authorization: TOKEN },
//   })
//     .then((data) => {
//       res.send(data.data);
//     })
//     .catch((err) => console.log('error getting styles', err.response.data));
// });

// // API request to get the reviews based on a different sort option
// app.get('/reviews/:params', (req, res) => {
//   const { params } = req.params;
//   axios.get(`${url}reviews/?product_${params}`, {
//     headers: { Authorization: TOKEN },
//   })
//     .then((data) => res.send(data.data))
//     .catch((err) => console.log('error getting reviews', err.response.data));
// });

// // API request to get the reviews meta data
// app.get('/reviews/meta/:params', (req, res) => {
//   const { params } = req.params;
//   axios.get(`${url}reviews/meta?product_${params}`, {
//     headers: { Authorization: TOKEN },
//   })
//     .then((data) => res.send(data.data))
//     .catch((err) => console.log('error getting reviews', err.response.data));
// });

// // API request to increment the helpfulness counter
// app.put('/reviews/help', (req, res) => {
//   axios.put(`${url}reviews/${req.body.id}/helpful`, { body: { review_id: req.body.id } }, {
//     headers: { Authorization: TOKEN },
//   })
//     .then(() => res.sendStatus(204))
//     .catch((err) => console.log('server help error', err));
// });

// // API request to remove the review
// app.put('/reviews/report', (req, res) => {
//   axios.put(`${url}reviews/${req.body.id}/report`, { body: { review_id: req.body.id } }, {
//     headers: { Authorization: TOKEN },
//   })
//     .then(() => res.send(204))
//     .catch((err) => console.log('server report error', err));
// });

// // API request to post a new review
// app.post('/newReview/', (req, res) => {
//   console.log('at the server', req.body);
//   axios.post(`${url}reviews`, req.body.reviewObj, {
//     headers: { Authorization: TOKEN },
//   })
//     .then((response) => {
//       console.log('server review submit success');
//       res.sendStatus(201);
//     })
//     .catch((err) => {
//       console.log('server review submit error', err);
//       res.sendStatus(500);
//     });
// });
