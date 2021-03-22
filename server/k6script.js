const http = require('k6/http');
const { sleep, check } = require('k6');
const { Counter } = require('k6/metrics');

export let options = {
  duration: '1s',
  vus: 10,
};

export default function () {
  const urlBase = 'http://localhost:8081'
  for (let id = 1; id <= 100; id++) {
    http.get(`${urlBase}/questions/${id}`, {
      tags: { name: 'GetAllQuestionsURL'},
    });
  }

  http.put(`${urlBase}/api/qa/answers/10/helpful`, {
    tags: { name: 'updateAnswerHelpful' }
  });

  // http.get('http://localhost:8081/questions/10');
  // check(res, { 'status was 200': (r) => r.status == 200 });

//   const checkRes = check(res, {
//     'status was 200': (r) => r.status == 200,
//   });

//   checkRes;
}