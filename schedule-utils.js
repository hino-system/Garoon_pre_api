const { readSchedulesDb, writeSchedulesDb, readUsersDb } = require("./db");
const { REPEAT_RULES, JST_OFFSET_MS } = require("./seeds");

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatJstDateTimeFromDate(date) {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return (
    String(shifted.getUTCFullYear()) +
    pad2(shifted.getUTCMonth() + 1) +
    pad2(shifted.getUTCDate()) +
    pad2(shifted.getUTCHours()) +
    pad2(shifted.getUTCMinutes())
  );
}

function parseCompactDateTime(value) {
  const match = /^([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})$/.exec(
    String(value || "").trim()
  );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const asDate = new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0));
  const normalized = formatJstDateTimeFromDate(asDate);

  if (normalized !== `${match[1]}${match[2]}${match[3]}${match[4]}${match[5]}`) {
    return null;
  }

  return { year, month, day, hour, minute };
}

function normalizeDateTime(value) {
  const compact = parseCompactDateTime(value);
  if (compact) {
    return (
      String(compact.year).padStart(4, "0") +
      pad2(compact.month) +
      pad2(compact.day) +
      pad2(compact.hour) +
      pad2(compact.minute)
    );
  }

  const parsed = new Date(String(value || "").trim());
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return formatJstDateTimeFromDate(parsed);
}

function validateDateTime(value) {
  return normalizeDateTime(value) != null;
}

function currentJstDateTimeString() {
  return formatJstDateTimeFromDate(new Date());
}

function normalizeDateKey(value) {
  const normalized = String(value || "").trim();
  if (/^[0-9]{8}$/.test(normalized)) return normalized;

  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(normalized);
  if (!match) return null;

  return `${match[1]}${match[2]}${match[3]}`;
}

function normalizeRepeatRule(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return REPEAT_RULES.has(normalized) ? normalized : "なし";
}

function parseDateParts(dateStr) {
  const normalized = normalizeDateKey(dateStr);
  if (!normalized) return null;

  return {
    year: Number(normalized.slice(0, 4)),
    month: Number(normalized.slice(4, 6)),
    day: Number(normalized.slice(6, 8))
  };
}

function formatDateParts(parts) {
  return `${String(parts.year).padStart(4, "0")}${pad2(parts.month)}${pad2(parts.day)}`;
}

function addDays(dateStr, days) {
  const parts = parseDateParts(dateStr);
  if (!parts) return dateStr;

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);

  return formatDateParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  });
}

function diffDays(fromDateStr, toDateStr) {
  const from = parseDateParts(fromDateStr);
  const to = parseDateParts(toDateStr);
  if (!from || !to) return 0;

  const fromDate = new Date(Date.UTC(from.year, from.month - 1, from.day));
  const toDate = new Date(Date.UTC(to.year, to.month - 1, to.day));

  return Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
}

function dayOfWeek(dateStr) {
  const parts = parseDateParts(dateStr);
  if (!parts) return -1;

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function dateKeyFromDateTime(value) {
  const normalized = normalizeDateTime(value);
  return normalized ? normalized.slice(0, 8) : null;
}

function timeKeyFromDateTime(value) {
  const normalized = normalizeDateTime(value);
  return normalized ? normalized.slice(8, 12) : null;
}

function materializeScheduleOccurrence(item, targetDate) {
  const normalizedTargetDate = normalizeDateKey(targetDate);
  const startDate = dateKeyFromDateTime(item.startAt);
  const endDate = dateKeyFromDateTime(item.endAt);
  const startTimePart = timeKeyFromDateTime(item.startAt);
  const endTimePart = timeKeyFromDateTime(item.endAt);
  const repeatRule = normalizeRepeatRule(item.repeatRule);

  if (!normalizedTargetDate || !startDate || !endDate || !startTimePart || !endTimePart) {
    return null;
  }

  if (normalizedTargetDate < startDate) {
    return null;
  }

  const targetDayOfWeek = dayOfWeek(normalizedTargetDate);
  const startDayOfWeek = dayOfWeek(startDate);
  const targetParts = parseDateParts(normalizedTargetDate);
  const startParts = parseDateParts(startDate);

  let matches = false;

  switch (repeatRule) {
    case "なし":
      matches = normalizedTargetDate === startDate;
      break;
    case "毎日":
      matches = true;
      break;
    case "営業日（月〜金）":
      matches = targetDayOfWeek >= 1 && targetDayOfWeek <= 5;
      break;
    case "毎週":
      matches = targetDayOfWeek === startDayOfWeek;
      break;
    case "毎月":
      matches = !!targetParts && !!startParts && targetParts.day === startParts.day;
      break;
    case "毎年":
      matches =
        !!targetParts &&
        !!startParts &&
        targetParts.month === startParts.month &&
        targetParts.day === startParts.day;
      break;
    default:
      matches = normalizedTargetDate === startDate;
      break;
  }

  if (!matches) {
    return null;
  }

  const endOffsetDays = diffDays(startDate, endDate);
  const occurrenceEndDate = addDays(normalizedTargetDate, endOffsetDays);

  return {
    ...item,
    startAt: `${normalizedTargetDate}${startTimePart}`,
    endAt: `${occurrenceEndDate}${endTimePart}`,
    repeatRule
  };
}

function visibleSchedules(items, targetUsers = []) {
  if (!targetUsers || targetUsers.length === 0) {
    return [];
  }

  return items.filter((item) => {
    if (item.ownerUserId) {
      return targetUsers.some((user) => user.id === item.ownerUserId);
    }

    return targetUsers.some((user) => {
      return item.organizerName === user.displayName || item.organizerName === user.userId;
    });
  });
}

function migrateSchedulesIfNeeded() {
  const schedulesDb = readSchedulesDb();
  const usersDb = readUsersDb();
  let changed = false;

  const migratedItems = schedulesDb.items.map((item) => {
    const normalizedStartAt = normalizeDateTime(item.startAt) || item.startAt;
    const normalizedEndAt = normalizeDateTime(item.endAt) || item.endAt;

    let next = {
      ...item,
      startAt: normalizedStartAt,
      endAt: normalizedEndAt
    };

    if (normalizedStartAt !== item.startAt || normalizedEndAt !== item.endAt) {
      changed = true;
    }

    if (next.ownerUserId) {
      return next;
    }

    const matchedUser = usersDb.items.find((user) => {
      return user.displayName === next.organizerName || user.userId === next.organizerName;
    });

    if (!matchedUser) {
      return next;
    }

    changed = true;

    return {
      ...next,
      ownerUserId: matchedUser.id,
      organizerName: next.organizerName || matchedUser.displayName
    };
  });

  if (changed) {
    writeSchedulesDb({ items: migratedItems });
  }
}

module.exports = {
  validateDateTime,
  normalizeDateTime,
  currentJstDateTimeString,
  normalizeDateKey,
  normalizeRepeatRule,
  materializeScheduleOccurrence,
  visibleSchedules,
  migrateSchedulesIfNeeded
};