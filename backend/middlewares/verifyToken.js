const jwt = require("jsonwebtoken");
/**
 * JWT 守門員：驗 Authorization header 的 Bearer token
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const verifyToken = function (req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "failed",
      message: "請先登入",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "failed",
        message: "Token 已過期",
      });
    }

    return res.status(401).json({
      status: "failed",
      message: "Token 無效或已過期",
    });
  }
};

module.exports = verifyToken;
