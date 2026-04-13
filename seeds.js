function roleFromPosition(position) {
  switch (position) {
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

const USER_ROWS = [
  [null, null, "社長", "佐藤", "1", "1"],
  ["営業部", null, "部長", "鈴木", "2", "2"],
  ["営業部", "営業1課", "課長", "高橋", "3", "3"],
  ["営業部", "営業1課", "一般", "田中", "4", "4"],
  ["営業部", "営業1課", "一般", "伊藤", "5", "5"],
  ["営業部", null, "部長", "渡辺", "6", "6"],
  ["営業部", "営業2課", "課長", "山本", "7", "7"],
  ["営業部", "営業2課", "一般", "中村", "8", "8"],
  ["営業部", "営業2課", "一般", "小林", "9", "9"],
  ["総務部", null, "部長", "加藤", "10", "10"],
  ["総務部", "総務1課", "課長", "吉田", "11", "11"],
  ["総務部", "総務1課", "一般", "山田", "12", "12"],
  ["総務部", "総務1課", "一般", "佐々木", "13", "13"],
  ["総務部", null, "部長", "山口", "14", "14"],
  ["総務部", "総務2課", "課長", "松本", "15", "15"],
  ["総務部", "総務2課", "一般", "井上", "16", "16"],
  ["総務部", "総務2課", "一般", "木村", "17", "17"],
  ["人事部", null, "部長", "林", "18", "18"],
  ["人事部", "人事1課", "課長", "斎藤", "19", "19"],
  ["人事部", "人事1課", "一般", "清水", "20", "20"],
  ["人事部", "人事1課", "一般", "山崎", "21", "21"],
  ["人事部", null, "部長", "森", "22", "22"],
  ["人事部", "人事2課", "課長", "池田", "23", "23"],
  ["人事部", "人事2課", "一般", "橋本", "24", "24"],
  ["人事部", "人事2課", "一般", "阿部", "25", "25"],
  ["情報システム部", null, "部長", "石川", "26", "26"],
  ["情報システム部", "情報システム1課", "課長", "山下", "27", "27"],
  ["情報システム部", "情報システム1課", "一般", "中島", "28", "28"],
  ["情報システム部", "情報システム1課", "一般", "石井", "29", "29"],
  ["情報システム部", null, "部長", "小川", "30", "30"],
  ["情報システム部", "情報システム2課", "課長", "前田", "31", "31"],
  ["情報システム部", "情報システム2課", "一般", "岡田", "32", "32"],
  ["情報システム部", "情報システム2課", "一般", "長谷川", "33", "33"]
].map(([department1, department2, position, displayName, userId, password]) => ({
  department1,
  department2,
  position,
  displayName,
  userId,
  password
}));

const USERS_SEED = {
  items: USER_ROWS.map((row, index) => ({
    id: `emp-${String(index + 1).padStart(3, "0")}`,
    userId: row.userId,
    password: row.password,
    displayName: row.displayName,
    department1: row.department1,
    department2: row.department2,
    position: row.position,
    role: roleFromPosition(row.position)
  }))
};

const BOARD_CATEGORIES_SEED = {
  items: [
    {
      id: "cat-company",
      name: "全社連絡",
      description: "全社員向けのお知らせを掲載します。",
      sortOrder: 1,
      viewPermissions: [
        { type: "role", value: "member" },
        { type: "role", value: "section_manager" },
        { type: "role", value: "department_manager" },
        { type: "role", value: "president" }
      ],
      postPermissions: [
        { type: "role", value: "department_manager" },
        { type: "role", value: "president" }
      ],
      adminPermissions: [
        { type: "role", value: "department_manager" },
        { type: "role", value: "president" }
      ]
    },
    {
      id: "cat-department",
      name: "部門連絡",
      description: "部門内のお知らせを共有します。",
      sortOrder: 2,
      viewPermissions: [
        { type: "role", value: "member" },
        { type: "role", value: "section_manager" },
        { type: "role", value: "department_manager" },
        { type: "role", value: "president" }
      ],
      postPermissions: [
        { type: "role", value: "section_manager" },
        { type: "role", value: "department_manager" },
        { type: "role", value: "president" }
      ],
      adminPermissions: [
        { type: "role", value: "section_manager" },
        { type: "role", value: "department_manager" },
        { type: "role", value: "president" }
      ]
    },
    {
      id: "cat-free",
      name: "社内共有",
      description: "自由に情報共有できる掲示板です。",
      sortOrder: 3,
      viewPermissions: [
        { type: "role", value: "member" },
        { type: "role", value: "section_manager" },
        { type: "role", value: "department_manager" },
        { type: "role", value: "president" }
      ],
      postPermissions: [
        { type: "role", value: "member" },
        { type: "role", value: "section_manager" },
        { type: "role", value: "department_manager" },
        { type: "role", value: "president" }
      ],
      adminPermissions: [
        { type: "role", value: "department_manager" },
        { type: "role", value: "president" }
      ]
    }
  ]
};

const REPEAT_RULES = new Set([
  "なし",
  "毎日",
  "営業日（月〜金）",
  "毎週",
  "毎月",
  "毎年"
]);

const BOARD_DEPARTMENT_CATEGORY_ID = "cat-department";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const KNOWN_DEPARTMENTS = [...new Set(USER_ROWS.map((row) => row.department1).filter(Boolean))];

module.exports = {
  roleFromPosition,
  USERS_SEED,
  BOARD_CATEGORIES_SEED,
  REPEAT_RULES,
  BOARD_DEPARTMENT_CATEGORY_ID,
  JST_OFFSET_MS,
  KNOWN_DEPARTMENTS
};