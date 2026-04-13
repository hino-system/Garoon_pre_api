const express = require("express");
const { authMiddleware, getBrowsableUsers, publicUser } = require("../auth");

const router = express.Router();

router.get("/", authMiddleware, (req, res) => {
  const items = getBrowsableUsers(req.authUser).map((user) => publicUser(user));
  res.json({ items });
});

module.exports = router;