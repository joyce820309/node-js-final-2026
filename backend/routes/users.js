const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { pool } = require("../config/db");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middlewares/verifyToken");
const { randomUUID } = require("crypto");
// const initialUsers = require('../fixtures/users.json');

router.get("/users/profile", verifyToken, (req, res) => {
  return res.status(200).json({ status: "success", user: req.user });
});

router.post("/users/signup", async (req, res) => {
  const id = randomUUID();
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

module.exports = router;
