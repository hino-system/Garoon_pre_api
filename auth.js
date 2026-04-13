const crypto = require("crypto");
const { readUsersDb, readSessionsDb, writeSessionsDb } = require("./db");
const { roleFromPosition } = require("./seeds");

function findUserByUserId(userId) {
  const usersDb = readUsersDb();
  return usersDb.items.find((user) => user.userId === userId) || null;
}

function findUserById(userId) {
  const usersDb = readUsersDb();
  return usersDb.items.find((user) => user.id === userId) || null;
}

function publicUser(user) {
  return {
    id: user.id,
    userId: user.userId,
    displayName: user.displayName,
    department1: user.department1 ?? null,
    department2: user.department2 ?? null,
    position: user.position ?? "",
    role: user.role ?? roleFromPosition(user.position)
  };
}

function createSession(userId) {
  const sessionsDb = readSessionsDb();
  const token = crypto.randomBytes(32).toString("hex");

  sessionsDb.items.push({
    token,
    userId,
    createdAt: new Date().toISOString()
  });

  writeSessionsDb(sessionsDb);
  return token;
}

function findSessionByToken(token) {
  const sessionsDb = readSessionsDb();
  return sessionsDb.items.find((item) => item.token === token) || null;
}

function authMiddleware(req, res, next) {
  const authorization = req.header("Authorization") || "";
  const prefix = "Bearer ";

  if (!authorization.startsWith(prefix)) {
    return res.status(401).json({ message: "Authorization header is required" });
  }

  const token = authorization.slice(prefix.length).trim();
  if (!token) {
    return res.status(401).json({ message: "Token is required" });
  }

  const session = findSessionByToken(token);
  if (!session) {
    return res.status(401).json({ message: "Invalid token" });
  }

  const user = findUserById(session.userId);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  req.authUser = user;
  req.authToken = token;
  next();
}

function getRole(user) {
  if (!user) return "member";

  if (user.role && String(user.role).trim()) {
    return user.role;
  }

  switch (user.position) {
    case "社長":
      return "president";
    case "部長":
      return "department_manager";
    case "課長":
      return "section_manager";
    default:
      return "member";
  }
}

function sameDepartment1(a, b) {
  return !!a?.department1 && !!b?.department1 && a.department1 === b.department1;
}

function sameDepartment2(a, b) {
  return (
    !!a?.department1 &&
    !!b?.department1 &&
    !!a?.department2 &&
    !!b?.department2 &&
    a.department1 === b.department1 &&
    a.department2 === b.department2
  );
}

function canBrowseUser(viewer, target) {
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return true;

  const role = getRole(viewer);

  switch (role) {
    case "president":
    case "department_manager":
      return true;
    case "section_manager":
      return sameDepartment1(viewer, target);
    case "member":
      return sameDepartment2(viewer, target);
    default:
      return viewer.id === target.id;
  }
}

function getBrowsableUsers(authUser) {
  const usersDb = readUsersDb();
  return usersDb.items.filter((user) => canBrowseUser(authUser, user));
}

function resolveScheduleTargetUsers(authUser, requestedUserIds = []) {
  const browsableUsers = getBrowsableUsers(authUser);
  const browsableMap = new Map(browsableUsers.map((user) => [user.id, user]));

  if (!requestedUserIds || requestedUserIds.length === 0) {
    return [authUser];
  }

  return requestedUserIds
    .map((userId) => browsableMap.get(userId))
    .filter(Boolean);
}

module.exports = {
  findUserByUserId,
  findUserById,
  publicUser,
  createSession,
  findSessionByToken,
  authMiddleware,
  getRole,
  canBrowseUser,
  getBrowsableUsers,
  resolveScheduleTargetUsers
};