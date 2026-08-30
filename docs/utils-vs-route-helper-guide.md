# Utils vs Route Helper 分層原則

這份筆記是給後端路由檔案整理時使用的判斷標準，目的是避免把「業務驗證」跟「共用工具」混在一起。

## 一、基本原則

### 1. 放到 utils 的東西

適合放到 utils 的，通常是「跨模組、跨路由、通用性高」的邏輯，條件是：

- 這段邏輯有可能被多個不同 route 重複使用
- 它不綁定特定業務場景
- 它的語意很通用、很小而且明確

例如：

- 驗證 UUID
- 驗證是否為 HTTPS 網址
- 格式化日期
- 去除空白字串
- 轉換貨幣格式

這類 function 很適合放到：

- backend/utils/validators.js
- backend/utils/formatters.js
- backend/utils/helpers.js

### 2. 放到 route helper 的東西

適合留在 route 檔案內的，通常是：

- 只服務某個特定路由群組
- 直接綁定某個 API 的業務規則
- 會牽涉到 payload 欄位、角色判斷、owner-scoped 檢查

例如：

- validateCoachProfileBody
- validateCourseBody
- getCourseStatus
- 某個 route 獨有的欄位驗證

這些邏輯比較像「業務規則」，不是全專案共用工具。

---

## 二、判斷方法

### 問題 1：這段邏輯會不會在其他檔案重複使用？

如果答案是「很可能會」，那就往 utils 移。

如果答案是「只有這個 route 或這個模組會用」，就留在 route 檔案裡。

### 問題 2：這段邏輯是通用工具，還是業務規則？

- 通用工具：
  - isUuid
  - isHttpsUrl
  - trimString
  - isFutureDate

- 業務規則：
  - validateCoachProfileBody
  - validateCourseBody
  - checkIfUserOwnsCourse
  - getCourseStatus

前者適合 utils，後者通常留在 route。

### 問題 3：拆出來會不會讓檔案變得碎？

如果拆到 utils 之後，反而要跨很多檔案追來追去，這就不是好拆法。

好的分層是：

- 真正共用的工具放 utils
- 特定業務的驗證留 route

---

## 三、實際案例

### 案例 A：`isHttpsUrl`

這個 function 很通用，因為它只是判斷 URL 格式，而且其他地方也可能需要。

適合：

- backend/utils/validators.js

例如：

```js
function isHttpsUrl(value) {
  return typeof value === "string" && value.trim().startsWith("https://");
}
```

這種純工具型 function，可以往 utils 收斂。

### 案例 B：`validateCoachProfileBody`

這個 function 會檢查：

- experience_years
- description
- profile_image_url
- skill_ids

它直接綁定「教練個人資料」的業務規則，且只有 admin coach 相關 route 會用。

因此它比較適合留在：

- backend/routes/admin-coaches.js

### 案例 C：`validateCourseBody`

這個 function 會檢查：

- skill_id
- name
- description
- start_at
- end_at
- max_participants
- meeting_url

這種是「開課 / 更新課程」的業務校驗，也只屬於 M3 教練後台邏輯，所以不一定要拆到 utils。

---

## 四、建議的分層策略

### 1. 最先放 utils 的

只放這類：

- 基礎格式驗證
- 通用字串處理
- 通用日期格式轉換
- 通用 UUID 檢查
- 通用網址驗證

### 2. 先留在 route 的

先留在 route 檔案內：

- 複合欄位驗證
- 權限邏輯
- owner-scoped 檢查
- 特定 API 的欄位合規檢查

### 3. 不要為了拆檔案而拆

如果你只是因為 function 有點長、就想搬到 utils，通常不值得。

只有當它真的變成跨模組共用的抽象工具，才值得移進 utils。

---

## 五、結論

最重要的原則是：

- 通用、可重用、語意抽象的工具 → utils
- 特定業務、綁定 route 需求的驗證 → route helper

所以對目前這個專案來說：

- `isHttpsUrl` 可以考慮移到 utils
- `validateCoachProfileBody` 跟 `validateCourseBody` 通常不需要移，因為它們本質上就是 M3 的業務規則

這樣分層最清楚，也最容易維護。

---

## 六、你現在可以直接套用的判斷

如果 function 只是在說：

- 「這個值是不是 UUID」
- 「這個字串是否是 HTTPS」
- 「這個值是否是日期」

那就放 utils。

如果 function 在說：

- 「這份教練資料是否合法」
- 「這堂課的欄位是否合規」
- 「這個人是不是課的主人」
- 「這個會員能不能報名這堂課」

那就留在 route。

這就是分層的關鍵。
