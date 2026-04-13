const express = require("express");
const cors = require("cors");

const {
  ensureJsonFile,
  SCHEDULES_DB_PATH,
  USERS_DB_PATH,
  SESSIONS_DB_PATH,
  BOARD_POSTS_DB_PATH,
  BOARD_CATEGORIES_DB_PATH,
  BOARD_COMMENTS_DB_PATH
} = require("./db");

const { USERS_SEED, BOARD_CATEGORIES_SEED } = require("./seeds");
const { migrateSchedulesIfNeeded } = require("./schedule-utils");
const { migrateBoardDataIfNeeded } = require("./board-utils");

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const schedulesRoutes = require("./routes/schedules");
const boardRoutes = require("./routes/board");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

ensureJsonFile(SCHEDULES_DB_PATH, { items: [] });
ensureJsonFile(USERS_DB_PATH, USERS_SEED);
ensureJsonFile(SESSIONS_DB_PATH, { items: [] });
ensureJsonFile(BOARD_POSTS_DB_PATH, { items: [] });
ensureJsonFile(BOARD_CATEGORIES_DB_PATH, BOARD_CATEGORIES_SEED);
ensureJsonFile(BOARD_COMMENTS_DB_PATH, { items: [] });

migrateSchedulesIfNeeded();
migrateBoardDataIfNeeded();

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/schedules", schedulesRoutes);
app.use("/api/v1", boardRoutes);

app.listen(PORT, () => {
  console.log(`API started: http://localhost:${PORT}`);
});