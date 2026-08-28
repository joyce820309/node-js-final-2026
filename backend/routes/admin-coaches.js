const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { isUuid } = require("../utils/validators")
const { sendErr } = require("../utils/response")
const verifyToken = require("../middlewares/verifyToken");

router.get("/admin/coaches", verifyToken, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.experience_years, c.description, c.profile_image_url,
      COALESCE(
        ARRAY_AGG(cs.skill_id) FILTER (WHERE cs.skill_id IS NOT NULL),
        '{}'
      ) AS skill_ids
      FROM coaches c
      LEFT JOIN coach_skills cs ON cs.coach_id = c.id
      WHERE c.user_id = $1
      GROUP BY c.id`,
      [req.user.id]);

    const user = result.rows[0];

    if (!user) {
      return sendErr(res, "無效的 token", 401);
    }

    if (req.user.role !== "COACH") {
      return sendErr(res, "使用者尚未成為教練", 401);
    }

    return res.status(200).json({
      status: "success",
      data: { id, experience_years, description, profile_image_url, skill_ids: [] },
    });
  } catch (err) {
    return next(err);
  }
});



router.post("/admin/coaches/:id", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { experience_years, description, profile_image_url } = req.body;


    const findUser = await pool.query(`
      SELECT id, name, role FROM users WHERE id = $1`,
      [userId]);

    if (!findUser.rows[0]) return sendErr(res, '使用者不存在', 400)
    if (user.role === "COACH") return sendErr(res, '使用者已經是教練', 409)



    const reslut = await pool.query(`
      UPDATE users SET role = 'COACH' WHERE id = $1`,
      [req.user.id]);

    return res.status(201).json({
      status: "success",
      data: {
        user: {
          name: user.name,
          role: "COACH"
        },
        coach: {
          id,
          user_id,
          experience_years,
          description,
          profile_image_url,
          created_at,
          updated_at
        }
      }
    })

  } catch (err) {
    return next(err)
  }
})



router.put("/admin/coaches", verifyToken, async (req, res, next) => {
  if (req.user.role !== "COACH") return sendErr(res, '使用者尚未成為教練', 401)
  const { experience_years, description, profile_image_url, skill_ids } = req.body;
  try {


    //     experience_years：number、整數、>= 0
    // description：非空字串
    // profile_image_url：非空字串，且以 https 開頭
    // skill_ids：陣列、不可為空，每個元素都是 UUID



    await pool.query(`
      UPDATE coaches
      SET
        experience_years = $1,
        description = $2,
        profile_image_url = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING id, user_id, experience_years,
        description, profile_image_url,
        created_at, updated_at
      `, [experience_years, description, profile_image_url, coachId])

    return res.status(200).json({
      status: "success",
      data: {
        id: coach.id,
        experience_years: coach.experience_years,
        description: coach.description,
        profile_image_url: coach.profile_image_url,
        skill_ids: skill_ids,
      },
    })

  } catch (err) {
    return next(err)
  }

})



router.get("/admin/coaches/courses", verifyToken, async (req, res, next) => {

  try {

  } catch (err) {
    return next(err)
  }

})


router.post("/admin/coaches/courses", verifyToken, async (req, res, next) => {

  try {

  } catch (err) {
    return next(err)
  }

})


router.get("/admin/coaches/courses/:id", verifyToken, async (req, res, next) => {

  try {

  } catch (err) {
    return next(err)
  }

})

router.put("/admin/coaches/courses/:id", verifyToken, async (req, res, next) => {

  try {

  } catch (err) {
    return next(err)
  }

})

module.exports = router;