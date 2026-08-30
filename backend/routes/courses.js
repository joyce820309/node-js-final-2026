const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { isUuid } = require("../utils/validators");
const { sendErr } = require("../utils/response");
const verifyToken = require("../middlewares/verifyToken");

// M5 API
router.post("/courses/:id", verifyToken, async (req, res, next) => {
  try {
    const { id: courseId } = req.params;

    if (!isUuid(courseId)) {
      return sendErr(res, "ID錯誤", 400);
    }

    const courseResult = await pool.query(
      "SELECT id, name, start_at, end_at, max_participants FROM courses WHERE id = $1",
      [courseId],
    );

    const course = courseResult.rows[0];
    if (!course) {
      return sendErr(res, "ID錯誤", 400);
    }

    const existingBooking = await pool.query(
      "SELECT id FROM course_bookings WHERE user_id = $1 AND course_id = $2",
      [req.user.id, courseId],
    );

    if (existingBooking.rowCount > 0) {
      return sendErr(res, "已經報名過此課程", 400);
    }

    const purchasedResult = await pool.query(
      `
      SELECT COALESCE(SUM(purchased_credits), 0)::int AS total_purchased
      FROM user_credit_packages
      WHERE user_id = $1
      `,
      [req.user.id],
    );

    const totalPurchased = Number(
      purchasedResult.rows[0]?.total_purchased ?? 0,
    );

    const activeBookingCount = await pool.query(
      `
      SELECT COUNT(*)::int AS active_count
      FROM course_bookings
      WHERE user_id = $1 AND cancelled_at IS NULL
      `,
      [req.user.id],
    );

    const creditUsage = Number(activeBookingCount.rows[0]?.active_count ?? 0);
    const creditRemain = totalPurchased - creditUsage;

    if (creditRemain <= 0) {
      return sendErr(res, "已無可使用堂數", 400);
    }

    const validParticipants = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM course_bookings
      WHERE course_id = $1 AND cancelled_at IS NULL
      `,
      [courseId],
    );

    const currentParticipants = Number(validParticipants.rows[0]?.count ?? 0);
    if (currentParticipants >= Number(course.max_participants)) {
      return sendErr(res, "已達最大參加人數，無法參加", 400);
    }

    await pool.query(
      `
      INSERT INTO course_bookings (user_id, course_id)
      VALUES ($1, $2)
      `,
      [req.user.id, courseId],
    );

    return res.status(201).json({
      status: "success",
      data: null,
    });
  } catch (err) {
    return next(err);
  }
});

router.delete("/courses/:id", verifyToken, async (req, res, next) => {
  try {
    const { id: courseId } = req.params;

    if (!isUuid(courseId)) {
      return sendErr(res, "ID錯誤", 400);
    }

    const bookingResult = await pool.query(
      `
      SELECT id
      FROM course_bookings
      WHERE user_id = $1 AND course_id = $2 AND cancelled_at IS NULL
      `,
      [req.user.id, courseId],
    );

    if (!bookingResult.rowCount) {
      return sendErr(res, "ID錯誤", 400);
    }

    const bookingId = bookingResult.rows[0].id;

    const updateResult = await pool.query(
      `
      UPDATE course_bookings
      SET cancelled_at = NOW()
      WHERE id = $1 AND cancelled_at IS NULL
      RETURNING id
      `,
      [bookingId],
    );

    if (!updateResult.rowCount) {
      return sendErr(res, "ID錯誤", 400);
    }

    return res.status(200).json({
      status: "success",
      data: null,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
