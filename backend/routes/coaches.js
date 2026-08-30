const express = require("express");
const router = express.Router();
const { isUuid } = require("../utils/validators");
const { pool } = require("../config/db");
const { sendErr } = require("../utils/response");

// M1 API
router.get("/coaches/skill", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM skills ORDER BY created_at",
    );

    return res.status(200).json({ status: "success", data: result.rows });
  } catch (err) {
    return next(err);
  }
});

router.post("/coaches/skill", async (req, res, next) => {
  const { name } = req.body;
  if (typeof name !== "string" || name.trim() === "") {
    return sendErr(res, "欄位未填寫正確", 400);
  }

  try {
    const isExistingSkill = await pool.query(
      "SELECT id, name FROM skills WHERE name = $1",
      [name],
    );

    if (!!isExistingSkill.rowCount) {
      return sendErr(res, "資料重複", 409);
    }

    const result = await pool.query(
      "INSERT INTO skills (name) VALUES ($1) RETURNING id, name",
      [name.trim()],
    );

    return res.status(200).json({ status: "success", data: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

router.delete("/coaches/skill/:id", async (req, res, next) => {
  const { id } = req.params;
  if (!isUuid(id)) return sendErr(res, "ID錯誤", 400);

  try {
    const isExistingSkill = await pool.query(
      "SELECT id, name FROM skills WHERE id = $1",
      [id],
    );

    if (!isExistingSkill.rowCount) return sendErr(res, "ID錯誤", 400);

    const result = await pool.query(
      "DELETE FROM skills WHERE id = $1 RETURNING id, name",
      [id],
    );

    return res.status(200).json({
      status: "success",
      data: { raw: result.rows[0], affected: result.rowCount },
    });
  } catch (err) {
    return next(err);
  }
});

// M4 API
router.get("/coaches", async (req, res, next) => {
  try {
    const per = Number(req.query.per);
    const page = Number(req.query.page);

    if (
      !Number.isInteger(per) ||
      per <= 0 ||
      !Number.isInteger(page) ||
      page <= 0
    ) {
      return sendErr(res, "欄位未填寫正確", 400);
    }

    const offset = (page - 1) * per;

    const result = await pool.query(
      `
        SELECT c.id, c.user_id, u.name
        FROM coaches c
        JOIN users u ON u.id = c.user_id
        ORDER BY c.created_at DESC
        LIMIT $1 OFFSET $2
      `,
      [per, offset],
    );

    return res.status(200).json({
      status: "success",
      data: result.rows.map((coach) => ({
        id: coach.id,
        user_id: coach.user_id,
        name: coach.name,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/coaches/:coachId", async (req, res, next) => {
  try {
    const { coachId } = req.params;

    if (!isUuid(coachId)) {
      return sendErr(res, "教練不存在", 400);
    }

    const coachResult = await pool.query(
      `
        SELECT c.id, c.user_id, c.experience_years, c.description, c.profile_image_url,
               u.name AS user_name
        FROM coaches c
        JOIN users u ON u.id = c.user_id
        WHERE c.id = $1
      `,
      [coachId],
    );

    const coach = coachResult.rows[0];
    if (!coach) {
      return sendErr(res, "教練不存在", 400);
    }

    const skillsResult = await pool.query(
      `
        SELECT s.id, s.name
        FROM coach_skills cs
        JOIN skills s ON s.id = cs.skill_id
        WHERE cs.coach_id = $1
        ORDER BY s.created_at ASC
      `,
      [coachId],
    );

    return res.status(200).json({
      status: "success",
      data: {
        user: {
          id: coach.user_id,
          name: coach.user_name,
        },
        coach: {
          id: coach.id,
          user_id: coach.user_id,
          experience_years: coach.experience_years,
          description: coach.description,
          profile_image_url: coach.profile_image_url,
          skills: skillsResult.rows,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/coaches/:coachId/courses", async (req, res, next) => {
  try {
    const { coachId } = req.params;

    if (!isUuid(coachId)) {
      return sendErr(res, "教練不存在", 400);
    }

    const result = await pool.query(
      `
        SELECT c.id, c.name, c.description, c.start_at, c.end_at,
               c.max_participants, c.meeting_url,
               u.name AS coach_name,
               s.name AS skill_name
        FROM courses c
        JOIN coaches coach ON coach.id = c.coach_id
        JOIN users u ON u.id = coach.user_id
        JOIN skills s ON s.id = c.skill_id
        WHERE c.coach_id = $1 AND c.end_at > NOW()
        ORDER BY c.start_at ASC
      `,
      [coachId],
    );

    return res.status(200).json({
      status: "success",
      data: result.rows.map((course) => ({
        id: course.id,
        name: course.name,
        description: course.description,
        start_at: course.start_at,
        end_at: course.end_at,
        max_participants: course.max_participants,
        meeting_url: course.meeting_url,
        coach_name: course.coach_name,
        skill_name: course.skill_name,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/courses", async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT c.id, c.name, c.description, c.start_at, c.end_at,
               c.max_participants, c.meeting_url,
               u.name AS coach_name,
               s.name AS skill_name
        FROM courses c
        JOIN coaches coach ON coach.id = c.coach_id
        JOIN users u ON u.id = coach.user_id
        JOIN skills s ON s.id = c.skill_id
        WHERE c.start_at <= NOW() AND c.end_at > NOW()
        ORDER BY c.start_at ASC
      `,
    );

    return res.status(200).json({
      status: "success",
      data: result.rows.map((course) => ({
        id: course.id,
        name: course.name,
        description: course.description,
        start_at: course.start_at,
        end_at: course.end_at,
        max_participants: course.max_participants,
        meeting_url: course.meeting_url,
        coach_name: course.coach_name,
        skill_name: course.skill_name,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
