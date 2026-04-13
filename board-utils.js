const {
  readBoardCategoriesDb,
  writeBoardCategoriesDb,
  readBoardPostsDb,
  writeBoardPostsDb,
  readBoardCommentsDb,
  writeBoardCommentsDb
} = require("./db");

const {
  BOARD_CATEGORIES_SEED,
  BOARD_DEPARTMENT_CATEGORY_ID,
  KNOWN_DEPARTMENTS
} = require("./seeds");

const { getRole } = require("./auth");
const { normalizeDateTime, currentJstDateTimeString } = require("./schedule-utils");

function normalizePermissionRule(rule) {
  if (!rule || typeof rule !== "object") return null;

  const type = String(rule.type || "").trim();
  const value = String(rule.value || "").trim();

  if (!type || !value) return null;

  return { type, value };
}

function normalizeBoardCategory(category) {
  return {
    ...category,
    description: category.description ?? "",
    sortOrder: Number(category.sortOrder || 0),
    viewPermissions: Array.isArray(category.viewPermissions)
      ? category.viewPermissions.map(normalizePermissionRule).filter(Boolean)
      : [],
    postPermissions: Array.isArray(category.postPermissions)
      ? category.postPermissions.map(normalizePermissionRule).filter(Boolean)
      : [],
    adminPermissions: Array.isArray(category.adminPermissions)
      ? category.adminPermissions.map(normalizePermissionRule).filter(Boolean)
      : []
  };
}

function normalizeDepartment1(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return KNOWN_DEPARTMENTS.includes(normalized) ? normalized : null;
}

function resolveDepartmentTarget(authUser, requestedDepartment1) {
  const userRole = getRole(authUser);
  const requested = normalizeDepartment1(requestedDepartment1);
  const ownDepartment = normalizeDepartment1(authUser.department1);

  if (userRole === "president") {
    return requested;
  }

  return ownDepartment || requested;
}

function matchesPermissionRule(user, rule) {
  if (!user || !rule) return false;

  switch (rule.type) {
    case "user":
      return user.id === rule.value;
    case "department1":
      return user.department1 === rule.value;
    case "department2":
      return user.department2 === rule.value;
    case "role":
      return getRole(user) === rule.value;
    default:
      return false;
  }
}

function hasCategoryPermission(user, rules = []) {
  return rules.some((rule) => matchesPermissionRule(user, rule));
}

function canViewBoardCategory(user, category) {
  return hasCategoryPermission(user, normalizeBoardCategory(category).viewPermissions);
}

function canPostBoardCategory(user, category) {
  return hasCategoryPermission(user, normalizeBoardCategory(category).postPermissions);
}

function canAdminBoardCategory(user, category) {
  return hasCategoryPermission(user, normalizeBoardCategory(category).adminPermissions);
}

function readNormalizedBoardCategories() {
  const db = readBoardCategoriesDb();
  return db.items.map((item) => normalizeBoardCategory(item));
}

function findBoardCategoryById(categoryId) {
  return readNormalizedBoardCategories().find((category) => category.id === categoryId) || null;
}

function boardPostVisibleToUser(user, post, category) {
  if (!canViewBoardCategory(user, category)) {
    return false;
  }

  if (category.id !== BOARD_DEPARTMENT_CATEGORY_ID) {
    return true;
  }

  const targetDepartment1 = normalizeDepartment1(post.targetDepartment1);

  if (!targetDepartment1) {
    return getRole(user) === "president";
  }

  return getRole(user) === "president" || user.department1 === targetDepartment1;
}

function boardStatusOf(post, nowValue = currentJstDateTimeString()) {
  const startAt = normalizeDateTime(post.startAt);
  const endAt = normalizeDateTime(post.endAt);
  const now = normalizeDateTime(nowValue);

  if (!startAt || !endAt || !now) {
    return "invalid";
  }

  if (now < startAt) return "upcoming";
  if (now > endAt) return "expired";
  return "active";
}

function sortBoardPosts(items) {
  return [...items].sort((a, b) => {
    return (
      new Date(String(b.updatedAt || b.createdAt || 0)).getTime() -
      new Date(String(a.updatedAt || a.createdAt || 0)).getTime()
    );
  });
}

function boardPostCanEdit(user, post, category) {
  if (!user || !post || !category) return false;
  return post.authorUserId === user.id || canAdminBoardCategory(user, category);
}

function boardPostCanDelete(user, post, category) {
  return boardPostCanEdit(user, post, category);
}

function boardCommentCanDelete(user, comment, category) {
  if (!user || !comment || !category) return false;
  return comment.authorUserId === user.id || canAdminBoardCategory(user, category);
}

function buildBoardPostSummary(user, post, category, comments = []) {
  const status = boardStatusOf(post);

  return {
    ...post,
    targetDepartment1: normalizeDepartment1(post.targetDepartment1),
    categoryName: category.name,
    status,
    canEdit: boardPostCanEdit(user, post, category),
    canDelete: boardPostCanDelete(user, post, category),
    canComment: !!post.allowComments && status === "active" && boardPostVisibleToUser(user, post, category),
    commentCount: comments.filter((comment) => comment.postId === post.id).length
  };
}

function buildBoardPostDetail(user, post, category, comments = []) {
  const sortedComments = comments
    .filter((comment) => comment.postId === post.id)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
    .map((comment) => ({
      ...comment,
      canDelete: boardCommentCanDelete(user, comment, category)
    }));

  return {
    ...buildBoardPostSummary(user, post, category, comments),
    comments: sortedComments
  };
}

function migrateBoardDataIfNeeded() {
  const categoriesDb = readBoardCategoriesDb();
  if (!Array.isArray(categoriesDb.items) || categoriesDb.items.length === 0) {
    writeBoardCategoriesDb(BOARD_CATEGORIES_SEED);
  }

  const postsDb = readBoardPostsDb();
  const commentsDb = readBoardCommentsDb();

  let postsChanged = false;
  let commentsChanged = false;

  const defaultCategoryId = BOARD_CATEGORIES_SEED.items[0].id;

  const migratedPosts = postsDb.items.map((item) => {
    const next = {
      ...item,
      categoryId: item.categoryId || defaultCategoryId,
      startAt: normalizeDateTime(item.startAt) || currentJstDateTimeString(),
      endAt: normalizeDateTime(item.endAt) || "209912312359",
      allowComments: item.allowComments !== false,
      editableUserIds: Array.isArray(item.editableUserIds) ? item.editableUserIds : [],
      createdAt: normalizeDateTime(item.createdAt) || currentJstDateTimeString(),
      updatedAt: normalizeDateTime(item.updatedAt || item.createdAt) || currentJstDateTimeString(),
      targetDepartment1: normalizeDepartment1(item.targetDepartment1)
    };

    if (
      next.categoryId !== item.categoryId ||
      next.startAt !== item.startAt ||
      next.endAt !== item.endAt ||
      next.allowComments !== item.allowComments ||
      next.createdAt !== item.createdAt ||
      next.updatedAt !== item.updatedAt ||
      next.targetDepartment1 !== item.targetDepartment1 ||
      !Array.isArray(item.editableUserIds)
    ) {
      postsChanged = true;
    }

    return next;
  });

  const migratedComments = commentsDb.items.map((item) => {
    const next = {
      ...item,
      createdAt: normalizeDateTime(item.createdAt) || currentJstDateTimeString(),
      updatedAt: normalizeDateTime(item.updatedAt || item.createdAt) || currentJstDateTimeString()
    };

    if (next.createdAt !== item.createdAt || next.updatedAt !== item.updatedAt) {
      commentsChanged = true;
    }

    return next;
  });

  if (postsChanged) {
    writeBoardPostsDb({ items: migratedPosts });
  }

  if (commentsChanged) {
    writeBoardCommentsDb({ items: migratedComments });
  }
}

module.exports = {
  normalizeBoardCategory,
  normalizeDepartment1,
  resolveDepartmentTarget,
  canViewBoardCategory,
  canPostBoardCategory,
  canAdminBoardCategory,
  readNormalizedBoardCategories,
  findBoardCategoryById,
  boardPostVisibleToUser,
  boardStatusOf,
  sortBoardPosts,
  boardPostCanEdit,
  boardPostCanDelete,
  boardCommentCanDelete,
  buildBoardPostSummary,
  buildBoardPostDetail,
  migrateBoardDataIfNeeded
};