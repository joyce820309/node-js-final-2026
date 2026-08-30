const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { isUuid } = require("../utils/validators");
const { sendErr } = require("../utils/response");
const verifyToken = require("../middlewares/verifyToken");

function isHttpsUrl(value) {
  return typeof value === "string" && value.trim().startsWith("https://");
}

function validateCoachProfileBody(body, requireProfileImage = false) {
  const { experience_years, description, profile_image_url, skill_ids } = body;

  if (!Number.isInteger(experience_years) || experience_years < 0) {
    return "欄位未填寫正確";
  }

  if (typeof description !== "string" || description.trim() === "") {
    return "欄位未填寫正確";
  }

  if (requireProfileImage) {
    if (
      typeof profile_image_url !== "string" ||
      profile_image_url.trim() === "" ||
      !isHttpsUrl(profile_image_url)
    ) {
      return "欄位未填寫正確";
    }
  } else if (
    profile_image_url !== undefined &&
    profile_image_url !== null &&
    profile_image_url !== "" &&
    !isHttpsUrl(profile_image_url)
  ) {
    return "欄位未填寫正確";
  }

  if (skill_ids !== undefined) {
    if (!Array.isArray(skill_ids) || skill_ids.length === 0) {
      return "欄位未填寫正確";
    }

    const invalid = skill_ids.some((id) => !isUuid(id));
    if (invalid) {
      return "欄位未填寫正確";
    }
  }

  return null;
}

function getCourseStatus(startAt, endAt) {
  const now = new Date();
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (now < start) return "尚未開始";
  if (now > end) return "已結束";
  return "進行中";
}

function validateCourseBody(body) {
  const {
    skill_id,
    name,
    description,
    start_at,
    end_at,
    max_participants,
    meeting_url,
  } = body;

  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedDescription =
    typeof description === "string" ? description.trim() : "";
  const trimmedMeetingUrl =
    typeof meeting_url === "string" ? meeting_url.trim() : "";

  const isValidMaxParticipants =
    Number.isInteger(max_participants) && max_participants >= 0;

  if (
    !skill_id ||
    !trimmedName ||
    !trimmedDescription ||
    typeof start_at !== "string" ||
    start_at.trim() === "" ||
    typeof end_at !== "string" ||
    end_at.trim() === "" ||
    !isValidMaxParticipants ||
    !trimmedMeetingUrl ||
    !isHttpsUrl(trimmedMeetingUrl) ||
    !isUuid(skill_id)
  ) {
    return null;
  }

  return {
    skill_id,
    name: trimmedName,
    description: trimmedDescription,
    start_at: start_at.trim(),
    end_at: end_at.trim(),
    max_participants: Number(max_participants),
    meeting_url: trimmedMeetingUrl,
  };
}

// M3 API

router.get("/admin/coaches", verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== "COACH") {
      return sendErr(res, "使用者尚未成為教練", 401);
    }

    const coachResult = await pool.query(
      `
      SELECT c.id, c.experience_years, c.description, c.profile_image_url,
             COALESCE(
               ARRAY_AGG(cs.skill_id) FILTER (WHERE cs.skill_id IS NOT NULL),
               '{}'
             ) AS skill_ids
      FROM coaches c
      LEFT JOIN coach_skills cs ON cs.coach_id = c.id
      WHERE c.user_id = $1
      GROUP BY c.id
      `,
      [req.user.id],
    );

    const coach = coachResult.rows[0];
    if (!coach) {
      return sendErr(res, "無效的 token", 401);
    }

    return res.status(200).json({
      status: "success",
      data: {
        id: coach.id,
        experience_years: coach.experience_years,
        description: coach.description,
        profile_image_url: coach.profile_image_url,
        skill_ids: Array.isArray(coach.skill_ids) ? coach.skill_ids : [],
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.put("/admin/coaches", verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== "COACH") {
      return sendErr(res, "使用者尚未成為教練", 401);
    }

    const { experience_years, description, profile_image_url, skill_ids } =
      req.body;
    const validationError = validateCoachProfileBody(
      {
        experience_years,
        description,
        profile_image_url,
        skill_ids,
      },
      true,
    );

    if (validationError) {
      return sendErr(res, validationError, 400);
    }

    const coachResult = await pool.query(
      `SELECT id, user_id, experience_years, description, profile_image_url
       FROM coaches WHERE user_id = $1`,
      [req.user.id],
    );

    const coach = coachResult.rows[0];
    if (!coach) {
      return sendErr(res, "使用者尚未成為教練", 401);
    }

    const updatedCoach = await pool.query(
      `
      UPDATE coaches
      SET experience_years = $1,
          description = $2,
          profile_image_url = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING id, user_id, experience_years, description, profile_image_url, created_at, updated_at
      `,
      [
        Number(experience_years),
        description.trim(),
        profile_image_url.trim(),
        coach.id,
      ],
    );

    await pool.query(`DELETE FROM coach_skills WHERE coach_id = $1`, [
      coach.id,
    ]);

    if (skill_ids.length > 0) {
      const values = skill_ids
        .map((_, index) => `($1, $${index + 2})`)
        .join(", ");
      await pool.query(
        `INSERT INTO coach_skills (coach_id, skill_id) VALUES ${values}`,
        [coach.id, ...skill_ids],
      );
    }

    return res.status(200).json({
      status: "success",
      data: {
        id: updatedCoach.rows[0].id,
        experience_years: updatedCoach.rows[0].experience_years,
        description: updatedCoach.rows[0].description,
        profile_image_url: updatedCoach.rows[0].profile_image_url,
        skill_ids,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/admin/coaches/courses", verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== "COACH") {
      return sendErr(res, "使用者尚未成為教練", 401);
    }

    const coachResult = await pool.query(
      `SELECT id FROM coaches WHERE user_id = $1`,
      [req.user.id],
    );

    const coach = coachResult.rows[0];
    if (!coach) {
      return sendErr(res, "無效的 token", 401);
    }

    const courseResult = await pool.query(
      `SELECT id, name, start_at, end_at, max_participants, meeting_url
       FROM courses
       WHERE coach_id = $1
       ORDER BY created_at DESC`,
      [coach.id],
    );

    return res.status(200).json({
      status: "success",
      data: courseResult.rows.map((course) => ({
        id: course.id,
        name: course.name,
        status: getCourseStatus(course.start_at, course.end_at),
        start_at: course.start_at,
        end_at: course.end_at,
        max_participants: course.max_participants,
        meeting_url: course.meeting_url,
        participants: 0,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/admin/coaches/courses", verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== "COACH") {
      return sendErr(res, "使用者尚未成為教練", 401);
    }

    const validated = validateCourseBody(req.body);
    if (!validated) {
      return sendErr(res, "欄位未填寫正確", 400);
    }

    const coachResult = await pool.query(
      `SELECT id FROM coaches WHERE user_id = $1`,
      [req.user.id],
    );

    const coach = coachResult.rows[0];
    if (!coach) {
      return sendErr(res, "無效的 token", 401);
    }

    const result = await pool.query(
      `
      INSERT INTO courses (
        coach_id,
        skill_id,
        name,
        description,
        start_at,
        end_at,
        max_participants,
        meeting_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        coach.id,
        validated.skill_id,
        validated.name,
        validated.description,
        validated.start_at,
        validated.end_at,
        validated.max_participants,
        validated.meeting_url,
      ],
    );

    return res.status(201).json({
      status: "success",
      data: {
        course: result.rows[0],
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get(
  "/admin/coaches/courses/:id",
  verifyToken,
  async (req, res, next) => {
    try {
      const { id: courseId } = req.params;

      if (!isUuid(courseId)) {
        return sendErr(res, "課程不存在", 400);
      }

      const coachResult = await pool.query(
        `SELECT id FROM coaches WHERE user_id = $1`,
        [req.user.id],
      );

      const coach = coachResult.rows[0];
      if (!coach) {
        return sendErr(res, "課程不存在", 400);
      }

      const courseResult = await pool.query(
        `SELECT c.*, s.id AS skill_id, s.name AS skill_name
       FROM courses c
       JOIN skills s ON s.id = c.skill_id
       WHERE c.id = $1 AND c.coach_id = $2`,
        [courseId, coach.id],
      );

      const course = courseResult.rows[0];
      if (!course) {
        return sendErr(res, "課程不存在", 400);
      }

      return res.status(200).json({
        status: "success",
        data: {
          id: course.id,
          name: course.name,
          description: course.description,
          start_at: course.start_at,
          end_at: course.end_at,
          max_participants: course.max_participants,
          skill_name: course.skill_name,
          skill_id: course.skill_id,
          meeting_url: course.meeting_url,
        },
      });
    } catch (err) {
      return next(err);
    }
  },
);

router.put(
  "/admin/coaches/courses/:id",
  verifyToken,
  async (req, res, next) => {
    try {
      const { id: courseId } = req.params;
      const validated = validateCourseBody(req.body);
      if (!validated) {
        return sendErr(res, "欄位未填寫正確", 400);
      }

      if (!isUuid(courseId)) {
        return sendErr(res, "課程不存在", 400);
      }

      const courseResult = await pool.query(
        `SELECT * FROM courses WHERE id = $1`,
        [courseId],
      );

      const course = courseResult.rows[0];
      if (!course) {
        return sendErr(res, "課程不存在", 400);
      }

      const coachResult = await pool.query(
        `SELECT id FROM coaches WHERE user_id = $1`,
        [req.user.id],
      );

      const coach = coachResult.rows[0];
      if (!coach) {
        return sendErr(res, "課程不存在", 400);
      }

      if (course.coach_id !== coach.id) {
        return sendErr(res, "課程不存在", 400);
      }

      const updatedCourseResult = await pool.query(
        `
      UPDATE courses
      SET skill_id = $1,
          name = $2,
          description = $3,
          start_at = $4,
          end_at = $5,
          max_participants = $6,
          meeting_url = $7,
          updated_at = NOW()
      WHERE id = $8
      RETURNING *
      `,
        [
          validated.skill_id,
          validated.name,
          validated.description,
          validated.start_at,
          validated.end_at,
          validated.max_participants,
          validated.meeting_url,
          courseId,
        ],
      );

      return res.status(200).json({
        status: "success",
        data: {
          course: updatedCourseResult.rows[0],
        },
      });
    } catch (err) {
      return next(err);
    }
  },
);

router.post("/admin/coaches/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { experience_years, description, profile_image_url } = req.body;

    if (!isUuid(userId)) {
      return sendErr(res, "使用者不存在", 400);
    }

    const userResult = await pool.query(
      `SELECT id, name, role FROM users WHERE id = $1`,
      [userId],
    );

    const user = userResult.rows[0];
    if (!user) return sendErr(res, "使用者不存在", 400);
    if (user.role === "COACH") return sendErr(res, "使用者已經是教練", 409);

    const errorMessage = validateCoachProfileBody(
      {
        experience_years,
        description,
        profile_image_url,
      },
      false,
    );

    if (errorMessage) {
      return sendErr(res, errorMessage, 400);
    }

    const coachResult = await pool.query(
      `
      INSERT INTO coaches (user_id, experience_years, description, profile_image_url)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, experience_years, description, profile_image_url, created_at, updated_at
      `,
      [
        userId,
        Number(experience_years),
        description.trim(),
        profile_image_url && profile_image_url.trim()
          ? profile_image_url.trim()
          : null,
      ],
    );

    const updatedUser = await pool.query(
      `UPDATE users SET role = 'COACH' WHERE id = $1 RETURNING id, name, role`,
      [userId],
    );

    return res.status(201).json({
      status: "success",
      data: {
        user: {
          name: updatedUser.rows[0].name,
          role: updatedUser.rows[0].role,
        },
        coach: coachResult.rows[0],
      },
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
