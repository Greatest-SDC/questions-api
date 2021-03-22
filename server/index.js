const express = require('express');
const morgan = require('morgan');
const axios = require('axios');
const path = require('path');
const { reset } = require('nodemon'); // from Ankylosaurus group

const client = require('../database');
// const { TOKEN } = require('../config.js');

const app = express();
const port = 8081;

app.use(morgan('dev'));
app.use(express.json());
// app.use(express.static('public')) // ankylosaurus has one a few lines below too

app.get('/questions/:params', (req, res) => {
  const { params } = req.params;
  const constSlicedParams = params.substring(3);

  allQuestions(constSlicedParams, (err, data) => {
    if (err) {
      console.log('error in get request to all questions: ', err)
    } else {
      res.send(data);
    }
  })
});

const allQuestions = async (params, callback) => {
  //// select questions.*, answers.*, array_agg(url) photos from questions inner join answers on (product_id = '1') left join answer_photos on (answers.answer_id = answer_photos.answer_id) where questions.question_id = answers.question_id group by questions.question_id, answers.answer_id, answers.question_id;

  const queryStr = `
  select questions.*, answers.*, array_agg(url) photos
  from questions
  inner join answers on (product_id = $1)
  left join answer_photos on (answers.answer_id = answer_photos.answer_id)
  where questions.question_id = answers.question_id
  and answers.reported = false
  group by questions.question_id, answers.answer_id, answers.question_id;
  `;

  let response;

  try {
    response = await client.query(queryStr, [params]);
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

      let photosArray = row.photos;
      if (photosArray[0] === null) {
        photosArray = []
      }

      const answerContents = {
        id: row.answer_id,
        body: row.body,
        date: row.date,
        answerer_name: row.answerer_name,
        helpfulness: row.helpfulness,
        photos: photosArray,
      };

      answersObj[rows[i].question_id][rows[i].answer_id] = answerContents;
    }
  }
  answerObjConstructor(response);

  // construct question results with all the questions as results into an array
  let resultsArray = [];
  const resultsArrayConstructor = (responseObj) => {
    const rows = responseObj.rows;
    const duplicates = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (duplicates.has(row.question_id)) {
        continue;
      }

      const resultContents = {
        question_id: row.question_id,
        question_body: row.question_body,
        question_date: row.question_date,
        asker_name: row.asker_name,
        question_helpfulness: row.question_helpfulness,
        reported: row.reported,
        answers: answersObj[row.question_id],
      }

      duplicates.add(row.question_id);
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

  postNewAnswer(questionId, reqBody, (err, data) => {
    if (err) {
      console.log('error in post request to add answer: ', err);
      res.sendStatus(500);
    } else {
      console.log('server answer submit response: ', data);
      res.sendStatus(201);
    }
  })
});

const postNewAnswer = async (questionId, answerInfo, callback) => {
  var date = new Date();
  var formattedDate = date.toISOString();
  let response;

  const queryStr = `insert into answers(question_id, body, date, answerer_name, answerer_email, helpfulness, reported) values ($1, $2, $3, $4, $5, 0, false);`;
  const params = [questionId, answerInfo.body, formattedDate, answerInfo.name, answerInfo.email]

  try {
    response = await client.query(queryStr, params);
  } catch(err) {
    console.log('error in post new answer query: ', err);
  }

  callback(null, response);
}

// API request to post a new question
app.post('/api/qa/questions', (req, res) => {
  const questionInfo = req.body;
  // to test, use body format:
  // {
  //   "body": "questionsValue",
  //   "name": "nicknameQues",
  //   "email": "emailQues",
  //   "product_id": prodId,
  // }

  postNewQuestion(questionInfo, (err, data) => {
    if (err) {
      console.log('error in post request to add question: ', err)
      res.sendStatus(500);
    } else {
      console.log('server question submit response: ', data);
      res.sendStatus(201);
    }
  })
});

const postNewQuestion = async (questionInfo, callback) => {
  var date = new Date();
  var formattedDate = date.toISOString();
  let response;

  const queryStr = `insert into questions(product_id, question_body, question_date, asker_name, asker_email, question_helpfulness, reported) values ($1, $2, $3, $4, $5, 0, false);`;
  const params = [questionInfo.product_id, questionInfo.body, formattedDate, questionInfo.name, questionInfo.email]

  try {
    response = await client.query(queryStr, params);
  } catch(err) {
    console.log('error in post new question query: ', err);
  }

  callback(null, response);
}

// API request to increment the helpfulness of an answer
app.put('/api/qa/answers/:answerId/helpful', (req, res) => {
  const { answerId } = req.params;
  incrementAnswerHelpfulness(answerId, (err, data) => {
    if (err) {
      console.log('server helpfulness put error', err);
      res.sendStatus(500);
    } else {
      console.log('server helpfulness put response: ', data);
      res.sendStatus(204);
    }
  })
});

const incrementAnswerHelpfulness = async (answerId, callback) => {
  let response;

  const queryStr = `update answers set helpfulness = (helpfulness + 1) where (answer_id = $1)`;
  const params = [answerId]
  try {
    response = await client.query(queryStr, params);
  } catch(err) {
    console.log('error in incrementing answer helpfulness: ', err);
  }

  callback(null, response);
}

// API request to increment the helpfulness of a question
app.put('/api/qa/questions/:questionId/helpful', (req, res) => {
  const { questionId } = req.params;

  incrementQuestionHelpfulness(questionId, (err, data) => {
    if (err) {
      console.log('server helpfulness question put error: ', err);
      res.sendStatus(500);
    } else {
      console.log('server helpfulness question put response: ', data);
      res.sendStatus(204);
    }
  })
});

const incrementQuestionHelpfulness = async (questionId, callback) => {
  let response;
  const queryStr = `update questions set question_helpfulness = (question_helpfulness + 1) where (question_id = $1)`;
  const params = [questionId];

  try {
    response = await client.query(queryStr, params);
  } catch(err) {
    console.log('error in incrementing question helpfulness: ', err);
  }

  callback(null, response);
}

// API request to report this answer
app.put('/api/qa/answers/:answerId/report', (req, res) => {
  const { answerId } = req.params;

  reportAnswer(answerId, (err, data) => {
    if (err) {
      console.log('server report put error: ', err);
      res.sendStatus(500);
    } else {
      console.log('server report put response: ', data);
      res.sendStatus(204);
    }
  })
});

const reportAnswer = async (answerId, callback) => {
  let response;
  const queryStr = `update answers set reported = true where (answer_id = $1)`;
  const params = [answerId];

  try {
    response = await client.query(queryStr, params);
  } catch(err) {
    console.log('error in updating answer as reported: ', err)
  }

  callback(null, response)
}

app.listen(port, () => {
  console.log(`questions api service listening at http://localhost:${port}`)
})

//////////////////////////////
// FROM ANKYLOSAURUS GROUP //
////////////////////////////

// const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
// app.use(express.static(PUBLIC_DIR));

const url = 'https://app-hrsei-api.herokuapp.com/api/fec2/hr-sea/';
            // 'https://app-hrsei-api.herokuapp.com/api/fec2/hr-sea/products/20113';
const TOKEN = 'c83882d4c9760249471a50a5d444d973ab86315c'
/// OTHER ENDPOINTS OLD CODE FROM FEC GROUP ////

// API request to get the product info
app.get('/product/:params', (req, res) => {
  const { params } = req.params;
  axios.get(`${url}products/${params}`, {
    headers: { Authorization: TOKEN },
  })
    .then((data) => {
      res.send(data.data);
    })
    .catch((err) => console.log('error getting product info', err.response.data));
});

// API request to get the styles
app.get('/styles/:params', (req, res) => {
  const { params } = req.params;
  axios.get(`${url}products/${params}/styles`, {
    headers: { Authorization: TOKEN },
  })
    .then((data) => {
      res.send(data.data);
    })
    .catch((err) => console.log('error getting styles', err.response.data));
});

// API request to get the reviews based on a different sort option
app.get('/reviews/:params', (req, res) => {
  const { params } = req.params;
  axios.get(`${url}reviews/?product_${params}`, {
    headers: { Authorization: TOKEN },
  })
    .then((data) => res.send(data.data))
    .catch((err) => console.log('error getting reviews', err.response.data));
});

// API request to get the reviews meta data
app.get('/reviews/meta/:params', (req, res) => {
  const { params } = req.params;
  axios.get(`${url}reviews/meta?product_${params}`, {
    headers: { Authorization: TOKEN },
  })
    .then((data) => res.send(data.data))
    .catch((err) => console.log('error getting reviews', err.response.data));
});

// API request to increment the helpfulness counter
app.put('/reviews/help', (req, res) => {
  axios.put(`${url}reviews/${req.body.id}/helpful`, { body: { review_id: req.body.id } }, {
    headers: { Authorization: TOKEN },
  })
    .then(() => res.sendStatus(204))
    .catch((err) => console.log('server help error', err));
});

// API request to remove the review
app.put('/reviews/report', (req, res) => {
  axios.put(`${url}reviews/${req.body.id}/report`, { body: { review_id: req.body.id } }, {
    headers: { Authorization: TOKEN },
  })
    .then(() => res.send(204))
    .catch((err) => console.log('server report error', err));
});

// API request to post a new review
app.post('/newReview/', (req, res) => {
  console.log('at the server', req.body);
  axios.post(`${url}reviews`, req.body.reviewObj, {
    headers: { Authorization: TOKEN },
  })
    .then((response) => {
      console.log('server review submit success');
      res.sendStatus(201);
    })
    .catch((err) => {
      console.log('server review submit error', err);
      res.sendStatus(500);
    });
});
