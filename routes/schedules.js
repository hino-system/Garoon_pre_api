const express = require("express");
const crypto = require("crypto");

const {
  readSchedulesDb,
  writeSchedulesDb,
  readUsersDb
} = require("../db");

const {
  authMiddleware,
  resolveScheduleTargetUsers,
  canBrowseUser,
  findUserById
} = require("../auth");

const {
  validateDateTime,
  normalizeDateTime,
  normalizeRepeatRule,
  materializeScheduleOccurrence,
  visibleSchedules
} = require("../schedule-utils");

const router = express.Router();

router.use(authMiddleware);

router.get("/", (req, res) => {
  const date = String(req.query.date || "").trim();
  const userIdsParam = String(req.query.userIds || "").trim();

  if (!date) {
    return res.status(400).json({ message: "date is required" });
  }

  const requestedUserIds = userIdsParam
    ? userIdsParam.split(",").map((v) => v.trim()).filter(Boolean)
    : [];

  const targetUsers = resolveScheduleTargetUsers(req.authUser, requestedUserIds);
  const schedulesDb = readSchedulesDb();

  const items = visibleSchedules(schedulesDb.items, targetUsers)
    .map((item) => materializeScheduleOccurrence(item, date))
    .filter(Boolean);

  res.json({ items });
});

router.get("/:id", (req, res) => {
  const scheduleId = String(req.params.id || "").trim();

  if (!scheduleId) {
    return res.status(400).json({ message: "schedule id is required" });
  }

  const schedulesDb = readSchedulesDb();
  const item = schedulesDb.items.find((schedule) => schedule.id === scheduleId);

  if (!item) {
    return res.status(404).json({ message: "Schedule not found" });
  }

  const ownerUser = item.ownerUserId
    ? findUserById(item.ownerUserId)
    : readUsersDb().items.find((user) => {
        return user.displayName === item.organizerName || user.userId === item.organizerName;
      });

  if (!ownerUser || !canBrowseUser(req.authUser, ownerUser)) {
    return res.status(404).json({ message: "Schedule not found" });
  }

  res.json({
    ...item,
    repeatRule: normalizeRepeatRule(item.repeatRule)
  });
});

router.post("/", (req, res) => {
  const { title, startAt, endAt, repeatRule, location, description } = req.body || {};

  if (!title || !startAt || !endAt) {
    return res.status(400).json({ message: "title, startAt, endAt are required" });
  }

  const normalizedStartAt = normalizeDateTime(startAt);
  const normalizedEndAt = normalizeDateTime(endAt);

  if (!normalizedStartAt || !normalizedEndAt || !validateDateTime(startAt) || !validateDateTime(endAt)) {
    return res.status(400).json({
      message: "startAt and endAt must be valid datetime strings"
    });
  }

  const schedulesDb = readSchedulesDb();

  const item = {
    id: crypto.randomUUID(),
    title,
    startAt: normalizedStartAt,
    endAt: normalizedEndAt,
    repeatRule: normalizeRepeatRule(repeatRule),
    location: location ?? null,
    description: description ?? null,
    ownerUserId: req.authUser.id,
    organizerName: req.authUser.displayName
  };

  schedulesDb.items.unshift(item);
  writeSchedulesDb(schedulesDb);

  res.status(201).json(item);
});

router.put("/:id", (req, res) => {
  const scheduleId = String(req.params.id || "").trim();
  const { title, startAt, endAt, repeatRule, location, description } = req.body || {};

  if (!scheduleId) {
    return res.status(400).json({ message: "schedule id is required" });
  }

  if (!title || !startAt || !endAt) {
    return res.status(400).json({ message: "title, startAt, endAt are required" });
  }

  const normalizedStartAt = normalizeDateTime(startAt);
  const normalizedEndAt = normalizeDateTime(endAt);

  if (!normalizedStartAt || !normalizedEndAt || !validateDateTime(startAt) || !validateDateTime(endAt)) {
    return res.status(400).json({
      message: "startAt and endAt must be valid datetime strings"
    });
  }

  const schedulesDb = readSchedulesDb();
  const index = schedulesDb.items.findIndex((item) => item.id === scheduleId);

  if (index < 0) {
    return res.status(404).json({ message: "Schedule not found" });
  }

  const current = schedulesDb.items[index];

  if (current.ownerUserId !== req.authUser.id) {
    return res.status(403).json({ message: "You cannot edit this schedule" });
  }

  const updated = {
    ...current,
    title,
    startAt: normalizedStartAt,
    endAt: normalizedEndAt,
    repeatRule: normalizeRepeatRule(repeatRule),
    location: location ?? null,
    description: description ?? null,
    ownerUserId: current.ownerUserId,
    organizerName: current.organizerName
  };

  schedulesDb.items[index] = updated;
  writeSchedulesDb(schedulesDb);

  res.json(updated);
});

module.exports = router;