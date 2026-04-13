const express = require("express");
const crypto = require("crypto");

const { authMiddleware } = require("../auth");
const {
  readBoardPostsDb,
  writeBoardPostsDb,
  readBoardCommentsDb,
  writeBoardCommentsDb
} = require("../db");

const {
  normalizeDateTime,
  currentJstDateTimeString
} = require("../schedule-utils");

const {
  findBoardCategoryById,
  readNormalizedBoardCategories,
  canViewBoardCategory,
  canPostBoardCategory,
  canAdminBoardCategory,
  boardPostVisibleToUser,
  boardStatusOf,
  sortBoardPosts,
  boardPostCanEdit,
  boardPostCanDelete,
  boardCommentCanDelete,
  buildBoardPostSummary,
  buildBoardPostDetail,
  normalizeDepartment1,
  resolveDepartmentTarget
} = require("../board-utils");

const {
  BOARD_DEPARTMENT_CATEGORY_ID
} = require("../seeds");

const router = express.Router();

router.use(authMiddleware);

router.get("/board-categories", (req, res) => {
  const categories = readNormalizedBoardCategories();
  const posts = readBoardPostsDb().items;

  const items = categories
    .filter((category) => canViewBoardCategory(req.authUser, category))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => {
      const visiblePosts = posts.filter((post) => {
        return post.categoryId === category.id && boardPostVisibleToUser(req.authUser, post, category);
      });

      const activePostCount = visiblePosts.filter((post) => boardStatusOf(post) === "active").length;

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        totalPostCount: visiblePosts.length,
        activePostCount,
        canPost: canPostBoardCategory(req.authUser, category),
        canAdmin: canAdminBoardCategory(req.authUser, category)
      };
    });

  res.json({ items });
});

router.get("/board-posts", (req, res) => {
  const categoryId = String(req.query.categoryId || "").trim();

  if (!categoryId) {
    return res.status(400).json({ message: "categoryId is required" });
  }

  const category = findBoardCategoryById(categoryId);

  if (!category || !canViewBoardCategory(req.authUser, category)) {
    return res.status(404).json({ message: "Category not found" });
  }

  const comments = readBoardCommentsDb().items;
  const posts = sortBoardPosts(
    readBoardPostsDb().items.filter((post) => {
      return post.categoryId === categoryId && boardPostVisibleToUser(req.authUser, post, category);
    })
  );

  res.json({
    category: {
      id: category.id,
      name: category.name,
      description: category.description,
      canPost: canPostBoardCategory(req.authUser, category),
      canAdmin: canAdminBoardCategory(req.authUser, category)
    },
    items: posts.map((post) => buildBoardPostSummary(req.authUser, post, category, comments))
  });
});

router.get("/board-posts/:id", (req, res) => {
  const postId = String(req.params.id || "").trim();

  if (!postId) {
    return res.status(400).json({ message: "post id is required" });
  }

  const postsDb = readBoardPostsDb();
  const post = postsDb.items.find((item) => item.id === postId);

  if (!post) {
    return res.status(404).json({ message: "Board post not found" });
  }

  const category = findBoardCategoryById(post.categoryId);

  if (!category || !boardPostVisibleToUser(req.authUser, post, category)) {
    return res.status(404).json({ message: "Board post not found" });
  }

  const commentsDb = readBoardCommentsDb();
  res.json(buildBoardPostDetail(req.authUser, post, category, commentsDb.items));
});

router.post("/board-posts", (req, res) => {
  const { categoryId, title, body, startAt, endAt, allowComments, targetDepartment1 } = req.body || {};

  if (!categoryId || !title || !body || !startAt || !endAt) {
    return res.status(400).json({
      message: "categoryId, title, body, startAt, endAt are required"
    });
  }

  const normalizedStartAt = normalizeDateTime(startAt);
  const normalizedEndAt = normalizeDateTime(endAt);

  if (!normalizedStartAt || !normalizedEndAt) {
    return res.status(400).json({ message: "startAt and endAt must be YYYYMMDDHHMM" });
  }

  if (normalizedStartAt >= normalizedEndAt) {
    return res.status(400).json({ message: "endAt must be later than startAt" });
  }

  const category = findBoardCategoryById(String(categoryId).trim());

  if (!category || !canPostBoardCategory(req.authUser, category)) {
    return res.status(403).json({ message: "このカテゴリーに投稿する権限がありません" });
  }

  const resolvedTargetDepartment1 =
    category.id === BOARD_DEPARTMENT_CATEGORY_ID
      ? resolveDepartmentTarget(req.authUser, targetDepartment1)
      : null;

  if (category.id === BOARD_DEPARTMENT_CATEGORY_ID && !resolvedTargetDepartment1) {
    return res.status(400).json({ message: "部門連絡では対象部門が必要です" });
  }

  const now = currentJstDateTimeString();
  const postsDb = readBoardPostsDb();

  const item = {
    id: crypto.randomUUID(),
    categoryId: category.id,
    targetDepartment1: resolvedTargetDepartment1,
    title: String(title).trim(),
    body: String(body).trim(),
    startAt: normalizedStartAt,
    endAt: normalizedEndAt,
    allowComments: allowComments !== false,
    editableUserIds: [],
    authorUserId: req.authUser.id,
    authorName: req.authUser.displayName,
    createdAt: now,
    updatedAt: now
  };

  postsDb.items.unshift(item);
  writeBoardPostsDb(postsDb);

  res.status(201).json(buildBoardPostDetail(req.authUser, item, category, []));
});

router.put("/board-posts/:id", (req, res) => {
  const postId = String(req.params.id || "").trim();
  const { title, body, startAt, endAt, allowComments, targetDepartment1 } = req.body || {};

  if (!postId) {
    return res.status(400).json({ message: "post id is required" });
  }

  if (!title || !body || !startAt || !endAt) {
    return res.status(400).json({
      message: "title, body, startAt, endAt are required"
    });
  }

  const normalizedStartAt = normalizeDateTime(startAt);
  const normalizedEndAt = normalizeDateTime(endAt);

  if (!normalizedStartAt || !normalizedEndAt) {
    return res.status(400).json({ message: "startAt and endAt must be YYYYMMDDHHMM" });
  }

  if (normalizedStartAt >= normalizedEndAt) {
    return res.status(400).json({ message: "endAt must be later than startAt" });
  }

  const postsDb = readBoardPostsDb();
  const index = postsDb.items.findIndex((item) => item.id === postId);

  if (index < 0) {
    return res.status(404).json({ message: "Board post not found" });
  }

  const current = postsDb.items[index];
  const category = findBoardCategoryById(current.categoryId);

  if (!category || !boardPostCanEdit(req.authUser, current, category)) {
    return res.status(403).json({ message: "この掲示を編集する権限がありません" });
  }

  const resolvedTargetDepartment1 =
    category.id === BOARD_DEPARTMENT_CATEGORY_ID
      ? resolveDepartmentTarget(req.authUser, targetDepartment1) || normalizeDepartment1(current.targetDepartment1)
      : null;

  if (category.id === BOARD_DEPARTMENT_CATEGORY_ID && !resolvedTargetDepartment1) {
    return res.status(400).json({ message: "部門連絡では対象部門が必要です" });
  }

  const updated = {
    ...current,
    targetDepartment1: resolvedTargetDepartment1,
    title: String(title).trim(),
    body: String(body).trim(),
    startAt: normalizedStartAt,
    endAt: normalizedEndAt,
    allowComments: allowComments !== false,
    updatedAt: currentJstDateTimeString()
  };

  postsDb.items[index] = updated;
  writeBoardPostsDb(postsDb);

  const commentsDb = readBoardCommentsDb();
  res.json(buildBoardPostDetail(req.authUser, updated, category, commentsDb.items));
});

router.delete("/board-posts/:id", (req, res) => {
  const postId = String(req.params.id || "").trim();

  if (!postId) {
    return res.status(400).json({ message: "post id is required" });
  }

  const postsDb = readBoardPostsDb();
  const index = postsDb.items.findIndex((item) => item.id === postId);

  if (index < 0) {
    return res.status(404).json({ message: "Board post not found" });
  }

  const current = postsDb.items[index];
  const category = findBoardCategoryById(current.categoryId);

  if (!category || !boardPostCanDelete(req.authUser, current, category)) {
    return res.status(403).json({ message: "この掲示を削除する権限がありません" });
  }

  postsDb.items.splice(index, 1);
  writeBoardPostsDb(postsDb);

  const commentsDb = readBoardCommentsDb();
  commentsDb.items = commentsDb.items.filter((comment) => comment.postId !== postId);
  writeBoardCommentsDb(commentsDb);

  res.json({ ok: true });
});

router.post("/board-posts/:id/comments", (req, res) => {
  const postId = String(req.params.id || "").trim();
  const { body } = req.body || {};

  if (!postId || !body || !String(body).trim()) {
    return res.status(400).json({ message: "body is required" });
  }

  const postsDb = readBoardPostsDb();
  const post = postsDb.items.find((item) => item.id === postId);

  if (!post) {
    return res.status(404).json({ message: "Board post not found" });
  }

  const category = findBoardCategoryById(post.categoryId);

  if (!category || !boardPostVisibleToUser(req.authUser, post, category)) {
    return res.status(404).json({ message: "Board post not found" });
  }

  if (!post.allowComments) {
    return res.status(400).json({ message: "この掲示はコメント不可です" });
  }

  if (boardStatusOf(post) !== "active") {
    return res.status(400).json({ message: "掲載期間外のためコメントできません" });
  }

  const commentsDb = readBoardCommentsDb();
  const now = currentJstDateTimeString();

  const item = {
    id: crypto.randomUUID(),
    postId,
    body: String(body).trim(),
    authorUserId: req.authUser.id,
    authorName: req.authUser.displayName,
    createdAt: now,
    updatedAt: now
  };

  commentsDb.items.push(item);
  writeBoardCommentsDb(commentsDb);

  res.status(201).json({
    ...item,
    canDelete: true
  });
});

router.delete("/board-comments/:id", (req, res) => {
  const commentId = String(req.params.id || "").trim();

  if (!commentId) {
    return res.status(400).json({ message: "comment id is required" });
  }

  const commentsDb = readBoardCommentsDb();
  const index = commentsDb.items.findIndex((item) => item.id === commentId);

  if (index < 0) {
    return res.status(404).json({ message: "Comment not found" });
  }

  const comment = commentsDb.items[index];
  const post = readBoardPostsDb().items.find((item) => item.id === comment.postId);

  if (!post) {
    commentsDb.items.splice(index, 1);
    writeBoardCommentsDb(commentsDb);
    return res.json({ ok: true });
  }

  const category = findBoardCategoryById(post.categoryId);

  if (!category || !boardCommentCanDelete(req.authUser, comment, category)) {
    return res.status(403).json({ message: "このコメントを削除する権限がありません" });
  }

  commentsDb.items.splice(index, 1);
  writeBoardCommentsDb(commentsDb);

  res.json({ ok: true });
});

module.exports = router;