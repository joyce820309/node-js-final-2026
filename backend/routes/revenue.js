const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { pool } = require("../config/db");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middlewares/verifyToken");
const { sendErr } = require("../utils/response");

function monthDist(m) {
  switch (m.toLowerCase()) {
    case "january":
      return 1;
    case "february":
      return 2;
    case "march":
      return 3;
    case "april":
      return 4;
    case "may":
      return 5;
    case "june":
      return 6;
    case "july":
      return 7;
    case "august":
      return 8;
    case "september":
      return 9;
    case "october":
      return 10;
    case "november":
      return 11;
    case "december":
      return 12;

    default:
      return 0;
  }
}

router.get("/admin/coaches/revenue", verifyToken, async (req, res, next) => {
  try {
    const coachResult = await pool.query(
      `SELECT id FROM coaches WHERE user_id = $1`,
      [req.user.id],
    );
    const coach = coachResult.rows[0];

    if (req.user.role !== "COACH") {
      return sendErr(res, "使用者尚未成為教練", 401);
    }
    // 2. month 轉數字，驗證合法（不在 MONTH_NAMES 裡就 400）
    const { month } = req.query;

    const monthNum = monthDist(month);
    if (monthNum < 1) return sendErr(res, "欄位未填寫正確", 400);

    // 3. 查詢 A 拿 participants/course_count

    const courseInfo = await pool.query(
      `
      SELECT COUNT(*) AS cnt
      FROM course_bookings cb
      JOIN courses c ON c.id = cb.course_id
      WHERE c.coach_id = $1
      AND cb.cancelled_at IS NULL
      AND EXTRACT(YEAR FROM cb.created_at) = $2
      AND EXTRACT(MONTH FROM cb.created_at) = $3
      `,
      [coach.id, new Date().getFullYear(), monthNum],
    );
    // 4. 查詢 B 拿 perCreditPrice

    const priceResult = await pool.query(
      `
      SELECT COALESCE(SUM(price), 0) AS total_price,
      COALESCE(SUM(credit_amount), 0) AS total_credits
      FROM credit_packages
      `,
    );

    const participants = Number(courseInfo.rows[0].cnt);
    const totalPrice = Number(priceResult.rows[0].total_price);
    const totalCredits = Number(priceResult.rows[0].total_credits);
    const perCreditPrice = totalCredits > 0 ? totalPrice / totalCredits : 0;
    const revenue = Math.floor(participants * perCreditPrice);

    // 5. 算 revenue，組回應
    return res.status(200).json({
      status: "success",
      data: {
        total: {
          revenue,
          participants,
          course_count: participants,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
