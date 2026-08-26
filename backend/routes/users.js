const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { pool } = require("../config/db");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middlewares/verifyToken");
const { randomUUID } = require("crypto");



router.post("/users/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({
      status: "failed",
      message: "欄位未填寫正確",
    });
  }

  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,16}$/;
  if (!passwordPattern.test(password)) {
    return res.status(400).json({
      status: "failed",
      message: "密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字",
    });
  }

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  if (existing.rows.length > 0) {
    return res.status(409).json({
      status: "failed",
      message: "Email 已被使用",
    });
  }

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
  if (!email || !password) {
    return res.status(400).json({
      status: "failed",
      message: "欄位未填寫正確",
    });
  }

  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({
      status: "failed",
      message: "Email 錯誤",
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({
      status: "failed",
      message: "密碼錯誤",
    });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  return res.status(200).json({
    status: "success",
    data: { token, user: { name: user.name } },
  });

})

router.get("/users/profile", verifyToken, (req, res) => {
  return res.status(200).json({ status: "success", data: { user: req.user } });
});

router.put("/users/profile", verifyToken, async (req, res, next) => {
  const { name } = req.body
  const userId = req.user.id
  const nameWoSpace = name.trim()
  if (typeof name !== 'string' || nameWoSpace === "") {
    return res.status(400).json({
      "status": "failed",
      "message": "欄位未填寫正確"
    })
  }

  try {
    const findUser = await pool.query(`
    SELECT name FROM users WHERE id = $1`, [userId]
    )

    const { userName } = findUser.rows[0]

    if (userName === nameWoSpace) {
      return res.status(400).json({
        "status": "failed",
        "message": "使用者名稱未變更"
      })
    }

    const result = await pool.query(`
      UPDATE users SET name = $1 WHERE = $2 RETURNING name`, [nameWoSpace, userId])


    return res.status(200).json({ status: "success", data: { user: { name: result.rows[0].name } } });



  } catch (err) {
    return next(err)
  }

});

// router.put("/users/password", verifyToken, (req, res) => {
//   const { name } = req.body
//    const userId = req.user.id
//    const nameWoSpace = name.trim()
//   return res.status(200).json({ status: "success", user: req.user });
// });

module.exports = router;
