const fs = require("fs");
const path = require("path");
const { USERS_SEED, BOARD_CATEGORIES_SEED } = require("./seeds");

const SCHEDULES_DB_PATH = path.join(__dirname, "schedules.json");
const USERS_DB_PATH = path.join(__dirname, "users.json");
const SESSIONS_DB_PATH = path.join(__dirname, "sessions.json");
const BOARD_POSTS_DB_PATH = path.join(__dirname, "board-posts.json");
const BOARD_CATEGORIES_DB_PATH = path.join(__dirname, "board-categories.json");
const BOARD_COMMENTS_DB_PATH = path.join(__dirname, "board-comments.json");

function ensureJsonFile(filePath, initialValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(initialValue, null, 2));
  }
}

function readJson(filePath, initialValue) {
  ensureJsonFile(filePath, initialValue);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function readSchedulesDb() {
  return readJson(SCHEDULES_DB_PATH, { items: [] });
}

function writeSchedulesDb(db) {
  writeJson(SCHEDULES_DB_PATH, db);
}

function readUsersDb() {
  return readJson(USERS_DB_PATH, USERS_SEED);
}

function readSessionsDb() {
  return readJson(SESSIONS_DB_PATH, { items: [] });
}

function writeSessionsDb(db) {
  writeJson(SESSIONS_DB_PATH, db);
}

function readBoardPostsDb() {
  return readJson(BOARD_POSTS_DB_PATH, { items: [] });
}

function writeBoardPostsDb(db) {
  writeJson(BOARD_POSTS_DB_PATH, db);
}

function readBoardCategoriesDb() {
  return readJson(BOARD_CATEGORIES_DB_PATH, BOARD_CATEGORIES_SEED);
}

function writeBoardCategoriesDb(db) {
  writeJson(BOARD_CATEGORIES_DB_PATH, db);
}

function readBoardCommentsDb() {
  return readJson(BOARD_COMMENTS_DB_PATH, { items: [] });
}

function writeBoardCommentsDb(db) {
  writeJson(BOARD_COMMENTS_DB_PATH, db);
}

module.exports = {
  SCHEDULES_DB_PATH,
  USERS_DB_PATH,
  SESSIONS_DB_PATH,
  BOARD_POSTS_DB_PATH,
  BOARD_CATEGORIES_DB_PATH,
  BOARD_COMMENTS_DB_PATH,
  ensureJsonFile,
  readJson,
  writeJson,
  readSchedulesDb,
  writeSchedulesDb,
  readUsersDb,
  readSessionsDb,
  writeSessionsDb,
  readBoardPostsDb,
  writeBoardPostsDb,
  readBoardCategoriesDb,
  writeBoardCategoriesDb,
  readBoardCommentsDb,
  writeBoardCommentsDb
};