const express = require("express");
const router = express.Router();
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const verifyToken = require('../middlewares/verifyToken');
// const initialUsers = require('../fixtures/users.json');

router.get("/healthcheck", (req, res) => {
  return res.status(200).type("text/plain").send("OK");
});

module.exports = router;
