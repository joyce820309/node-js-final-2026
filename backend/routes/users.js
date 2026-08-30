const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { pool } = require("../config/db");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middlewares/verifyToken");
const { sendErr } = require("../utils/response");

// M2 API
router.post("/users/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return sendErr(res, "欄位未填寫正確", 400);

  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,16}$/;
  if (!passwordPattern.test(password)) {
    return sendErr(
      res,
      "密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字",
      400,
    );
  }

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  if (existing.rows.length > 0) return sendErr(res, "Email 已被使用", 409);

  const hashedPwd = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `
  INSERT INTO users (name, email, password)
  VALUES ($1, $2, $3)
  RETURNING id, name
  `,
    [name, email, hashedPwd],
  );

  const user = result.rows[0];

  return res.status(201).json({
    status: "success",
    data: {
      user: { id: user.id, name: user.name },
    },
  });
});

router.post("/users/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return sendErr(res, "欄位未填寫正確", 400);

  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  const user = result.rows[0];
  if (!user) return sendErr(res, "Email 錯誤", 401);

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return sendErr(res, "密碼錯誤", 401);

  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  return res.status(200).json({
    status: "success",
    data: { token, user: { name: user.name } },
  });
});

router.get("/users/profile", verifyToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT name, email FROM users WHERE id = $1",
      [req.user.id],
    );

    const user = result.rows[0];

    if (!user) {
      return sendErr(res, "無效的 token", 401);
    }

    return res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (err) {
    return next(err);
  }
});

router.put("/users/profile", verifyToken, async (req, res, next) => {
  const { name } = req.body;
  const userId = req.user.id;
  if (typeof name !== "string") return sendErr(res, "欄位未填寫正確", 400);

  const nameWoSpace = name.trim();

  if (nameWoSpace === "") return sendErr(res, "欄位未填寫正確", 400);

  try {
    const findUser = await pool.query(
      `
    SELECT name FROM users WHERE id = $1`,
      [userId],
    );

    const currentName = findUser.rows[0].name;

    if (currentName === nameWoSpace) {
      return sendErr(res, "使用者名稱未變更", 400);
    }

    const result = await pool.query(
      `
      UPDATE users SET name = $1 WHERE id = $2 RETURNING name, email`,
      [nameWoSpace, userId],
    );

    return res.status(200).json({
      status: "success",
      data: {
        user: { name: result.rows[0].name, email: result.rows[0].email },
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.put("/users/password", verifyToken, async (req, res, next) => {
  const { password, new_password, confirm_new_password } = req.body;
  const userId = req.user.id;
  const pwd = password?.trim();
  const newPwd = new_password?.trim();
  const confirmPwd = confirm_new_password?.trim();

  const fullForm = pwd && newPwd && confirmPwd;
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,16}$/;

  if (!fullForm) return sendErr(res, "欄位未填寫正確", 400);
  if (pwd === newPwd) return sendErr(res, "新密碼不能與舊密碼相同", 400);

  if (
    !passwordPattern.test(pwd) ||
    !passwordPattern.test(newPwd) ||
    !passwordPattern.test(confirmPwd)
  ) {
    return sendErr(
      res,
      "密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字",
      400,
    );
  }

  if (newPwd != confirmPwd)
    return sendErr(res, "新密碼與驗證新密碼不一致", 400);

  try {
    const userResult = await pool.query(
      `
      SELECT password FROM users WHERE id = $1`,
      [userId],
    );
    const userInfo = userResult.rows[0];

    const isValid = await bcrypt.compare(pwd, userInfo.password);
    if (!userInfo) return sendErr(res, "密碼輸入錯誤", 400);

    const hashedPwd = await bcrypt.hash(newPwd, 10);

    await pool.query(
      `
      UPDATE users SET password = $1 WHERE id = $2`,
      [hashedPwd, userId],
    );

    return res.status(200).json({ status: "success", data: null });
  } catch (err) {
    return next(err);
  }
});

// M5 API
router.get("/users/courses", verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [creditResult, bookingResult] = await Promise.all([
      pool.query(
        `
        SELECT COALESCE(SUM(purchased_credits), 0)::int AS total_purchased
        FROM user_credit_packages
        WHERE user_id = $1
        `,
        [userId],
      ),
      pool.query(
        `
        SELECT
          c.id AS course_id,
          c.name,
          c.start_at,
          c.end_at,
          c.meeting_url,
          coach_user.name AS coach_name,
          cb.cancelled_at
        FROM course_bookings cb
        JOIN courses c ON c.id = cb.course_id
        JOIN coaches coach ON coach.id = c.coach_id
        JOIN users coach_user ON coach_user.id = coach.user_id
        WHERE cb.user_id = $1
        ORDER BY c.start_at ASC
        `,
        [userId],
      ),
    ]);

    const totalPurchased = Number(creditResult.rows[0]?.total_purchased ?? 0);
    const courseBooking = bookingResult.rows;
    const creditUsage = courseBooking.filter(
      (course) => course.cancelled_at === null,
    ).length;
    const creditRemain = totalPurchased - creditUsage;

    return res.status(200).json({
      status: "success",
      data: {
        credit_remain: creditRemain,
        credit_usage: creditUsage,
        course_booking: courseBooking,
      },
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
