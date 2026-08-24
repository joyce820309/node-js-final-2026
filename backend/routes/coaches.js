const express = require("express");
const router = express.Router();
// const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middlewares/verifyToken");

// router.get("/users/profile", verifyToken, (req, res) => {
//   return res.status(200).json({ status: "success", user: req.user });
// });

module.exports = router;
