DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS answers CASCADE;
DROP TABLE IF EXISTS answer_photos CASCADE;

CREATE TABLE questions (
  product_id VARCHAR(10),
  question_id INTEGER PRIMARY KEY,
  question_body VARCHAR(500),
  question_date VARCHAR(30),
  asker_name VARCHAR(50),
  asker_email VARCHAR(100),
  question_helpfulness INTEGER,
  reported BOOLEAN
);

CREATE TABLE answers (
  question_id INTEGER REFERENCES questions (question_id),
  answer_id INTEGER PRIMARY KEY,
  body VARCHAR(500),
  date VARCHAR(30),
  answerer_name VARCHAR(50),
  answerer_email VARCHAR(100),
  helpfulness INTEGER,
  reported BOOLEAN
);

CREATE TABLE answer_photos (
  id INTEGER PRIMARY KEY,
  answer_id INTEGER REFERENCES answers (answer_id),
  url VARCHAR(200)
);

CREATE UNIQUE INDEX question_id_index ON questions (question_id);
CREATE UNIQUE INDEX answer_id_index ON answers (answer_id);
CREATE UNIQUE INDEX photo_id ON answer_photos (id);
CREATE INDEX answer_photos_answer_id_index ON answer_photos (answer_id);
CREATE INDEX product_id_index ON questions (product_id);
CREATE INDEX answers_question_id_index ON answers (question_id);