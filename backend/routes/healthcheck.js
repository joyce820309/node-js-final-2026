const express = require("express");
const router = express.Router();

// M0 API
router.get("/healthcheck", (req, res) => {
  return res.status(200).type("text/plain").send("OK");
});

module.exports = router;
