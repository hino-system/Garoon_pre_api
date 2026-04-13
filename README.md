# Garoon_pre_api

`Garoon_pre` Android アプリ向けのローカル API サーバーです。  
業務系グループウェアを想定したデモ用バックエンドとして、**ログイン / ユーザー一覧 / スケジュール / 掲示板** の最小構成を Express で実装しています。

本リポジトリは、Android アプリ側の設計・実装確認を支えるための簡易 API です。  
本番運用を目的とした構成ではなく、**ローカル動作確認・ポートフォリオ用途**を前提としています。

---

## 概要

この API で提供している主な機能は以下です。

- ログイン
- ユーザー一覧取得
- スケジュール一覧 / 詳細 / 作成 / 編集
- 掲示板カテゴリ一覧
- 掲示板投稿一覧 / 詳細 / 作成 / 編集 / 削除
- コメント投稿 / 削除

データは RDB ではなく、リポジトリ内の JSON ファイルを簡易 DB として扱います。

---

## 技術スタック

- Node.js
- Express
- CORS
- JSON ファイルベースの簡易データ保存

---

## 起動方法

### 1. インストール

```bash
npm install
```

### 2. サーバー起動

```bash
npm start
```

起動後、以下でアクセスできます。

- API ベース URL: `http://localhost:3000`
- ヘルスチェック: `GET /health`

---

## Android アプリとの接続

Android アプリは、ログイン画面から接続先を切り替えて利用します。

### エミュレーターから接続する場合
- 接続先: `http://10.0.2.2:3000/`

### USB 接続した実機から接続する場合
- 接続先: `http://localhost:3000/`
- 前提: `adb reverse` を使って PC のローカルサーバーへ接続する

例:

```bash
adb reverse tcp:3000 tcp:3000
```

---

## API 一覧

### ヘルスチェック
- `GET /health`

### 認証
- `POST /api/v1/auth/login`

### ユーザー
- `GET /api/v1/users`

### スケジュール
- `GET /api/v1/schedules?date=YYYYMMDD&userIds=emp-001,emp-002`
- `GET /api/v1/schedules/:id`
- `POST /api/v1/schedules`
- `PUT /api/v1/schedules/:id`

### 掲示板
- `GET /api/v1/board-categories`
- `GET /api/v1/board-posts?categoryId=cat-company`
- `GET /api/v1/board-posts/:id`
- `POST /api/v1/board-posts`
- `PUT /api/v1/board-posts/:id`
- `DELETE /api/v1/board-posts/:id`
- `POST /api/v1/board-posts/:id/comments`
- `DELETE /api/v1/board-comments/:id`

---

## 認証

ログイン成功後にトークンを返します。  
以降の認証付き API では、`Authorization` ヘッダーに Bearer トークンを付与してください。

例:

```http
Authorization: Bearer <token>
```

### ログイン例

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "userId": "2",
  "password": "2"
}
```

レスポンス例:

```json
{
  "token": "xxxxx",
  "user": {
    "id": "emp-002",
    "userId": "2",
    "displayName": "鈴木",
    "department1": "営業部",
    "department2": null,
    "position": "部長",
    "role": "department_manager"
  }
}
```

---

## テスト用ユーザー

ユーザーは固定の seed データを持っています。  
例として以下のようなユーザーでログインできます。

- `1 / 1` … 社長
- `2 / 2` … 営業部 部長
- `3 / 3` … 営業部 営業1課 課長
- `10 / 10` … 総務部 部長
- `18 / 18` … 人事部 部長
- `26 / 26` … 情報システム部 部長

ユーザーは `1` ～ `33` まで存在します。

---

## データファイル

本 API は、リポジトリ直下の JSON ファイルを簡易 DB として利用します。

- `users.json`
- `sessions.json`
- `schedules.json`
- `board-categories.json`
- `board-posts.json`
- `board-comments.json`

### データ生成ルール
サーバー起動時に、対象ファイルが存在しない場合は初期値で生成します。

- `users.json` → `seeds.js` のユーザー seed を使用
- `board-categories.json` → `seeds.js` のカテゴリ seed を使用
- それ以外 → 空配列ベースで初期化

---

## 掲示板カテゴリ

掲示板は次の 3 カテゴリを持ちます。

- `cat-company` … 全社連絡
- `cat-department` … 部門連絡
- `cat-free` … 社内共有

カテゴリごとに閲覧・投稿・管理権限を設定しています。

### 例
- 全社連絡
  - 閲覧: 全社員
  - 投稿 / 管理: 部長・社長
- 部門連絡
  - 閲覧: 全社員
  - 投稿 / 管理: 課長・部長・社長
- 社内共有
  - 閲覧 / 投稿: 全社員
  - 管理: 部長・社長

---

## 権限制御

ユーザーの役職からロールを決定し、API の閲覧範囲や投稿権限を制御しています。

- `president`
- `department_manager`
- `section_manager`
- `member`

### ユーザー一覧 / スケジュールの閲覧範囲
- 社長、部長 → 全ユーザーを閲覧可能
- 課長 → 同じ部門まで閲覧可能
- 一般 → 同じ課まで閲覧可能

### 掲示板の閲覧範囲
- カテゴリ権限に加えて、部門連絡では `targetDepartment1` を見て表示制御します
- 社長は全て閲覧可能です

---

## スケジュール仕様

### 日時形式
スケジュールの日時は基本的に `YYYYMMDDHHMM` 形式で扱います。

例:

- `202604151000`
- `202605011730`

ISO 文字列が渡された場合でも、内部で JST ベースに正規化します。

### 繰り返し予定
対応している繰り返しルール:

- `なし`
- `毎日`
- `営業日（月〜金）`
- `毎週`
- `毎月`
- `毎年`

`GET /api/v1/schedules` では、指定日の予定に展開して返します。

---

## 掲示板仕様

### 投稿
投稿時に必要な基本項目:

- `categoryId`
- `title`
- `body`
- `startAt`
- `endAt`

部門連絡 (`cat-department`) の場合は、対象部門 `targetDepartment1` が必要です。

### コメント
コメントは、以下の条件を満たすと投稿できます。

- 投稿が存在する
- 投稿が閲覧可能
- `allowComments` が `true`
- 掲載期間中である

---

## マイグレーション処理

サーバー起動時に軽い整形処理を行っています。

### スケジュール
- 日時形式の正規化
- `ownerUserId` 未設定データの補完

### 掲示板
- 日時形式の正規化
- 権限・カテゴリ関連の不足項目補完
- コメント日時の正規化

既存 JSON を大きく壊さずに、最低限の整合性を取る用途です。

---

## 想定ユースケース

- Android アプリのローカル動作確認
- エミュレーター / 実機からの API 疎通確認
- スケジュール・掲示板 UI のデモ
- ポートフォリオ用の再現可能なバックエンド

---

## 制約

この API は簡易構成のため、以下は本格対応していません。

- RDB / ORM の利用
- 永続セッション管理の高度化
- ログアウト API
- ユーザー管理画面
- 本番運用向けの認証 / 監査 / セキュリティ強化
- バリデーションの完全整備

---

## ディレクトリ構成

```text
.
├─ package.json
├─ server.js
├─ db.js
├─ auth.js
├─ schedule-utils.js
├─ board-utils.js
├─ seeds.js
├─ routes/
│  ├─ auth.js
│  ├─ users.js
│  ├─ schedules.js
│  └─ board.js
├─ users.json
├─ sessions.json
├─ schedules.json
├─ board-categories.json
├─ board-posts.json
└─ board-comments.json
```

---

## 補足

このリポジトリは API 単体で完結するものというより、  
Android アプリ `Garoon_pre` の動作確認用バックエンドとして位置付けています。

そのため、構成は意図的に小さく保ち、  
**Android 側の設計・UI・状態管理・テストを主役にできるようにしている**のが特徴です。
