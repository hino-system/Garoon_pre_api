const express = require("express");
const { findUserByUserId, createSession, publicUser } = require("../auth");

const router = express.Router();

router.post("/login", (req, res) => {
  const { userId, password } = req.body || {};

  if (!userId || !password) {
    return res.status(400).json({ message: "userId and password are required" });
  }

  const user = findUserByUserId(userId);

  if (!user || user.password !== password) {
    return res.status(401).json({ message: "ユーザーIDまたはパスワードが正しくありません" });
  }

  const token = createSession(user.id);

  res.json({
    token,
    user: publicUser(user)
  });
});

module.exports = router;