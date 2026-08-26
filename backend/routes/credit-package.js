const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const { isUuid } = require("../utils/validators")

router.get("/credit-package", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, name, credit_amount, price FROM credit_packages ORDER BY created_at",
    );

    return res.status(200).json({ status: "success", data: result.rows });
  } catch (err) {
    return next(err);
  }
});


router.post("/credit-package", async (req, res, next) => {
  const { name, credit_amount, price } = req.body;


  const validName = typeof name === "string" && name.trim() !== "";
  const validCreditAmount = typeof credit_amount === "number" && Number.isInteger(credit_amount) && credit_amount >= 0;
  const validPrice = typeof price === 'number' && Number.isInteger(price) && price >= 0;


  if (!validName || !validCreditAmount || !validPrice) {
    return res.status(400).json({ status: "failed", message: "欄位未填寫正確" });
  }


  const isExistingName = await pool.query(
    "SELECT name FROM credit_packages WHERE name = $1", [name]
  );

  if (isExistingName.rows.length > 0) {
    return res.status(409).json({ status: "failed", message: "資料重複" });
  }

  try {
    const result = await pool.query(
      'INSERT INTO credit_packages (name, credit_amount, price) VALUES ($1, $2, $3) RETURNING id, name, credit_amount, price',
      [name.trim(), credit_amount, price]
    );

    return res.status(200).json({ status: "success", data: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});



router.delete("/credit-package/:id", async (req, res, next) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    return res.status(400).json({ status: "failed", message: "ID錯誤" });
  }

  try {


    const isExistingPkg = await pool.query(
      "SELECT id, name FROM credit_packages WHERE id = $1", [id]
    );


    if (!isExistingPkg.rowCount) {
      return res.status(400).json({ status: "failed", message: "ID錯誤" });
    }

    const result = await pool.query(
      'DELETE FROM credit_packages WHERE id = $1 RETURNING id, name, credit_amount, price', [id]
    );

    return res.status(200).json({ status: "success", data: { raw: result.rows[0], affected: result.rowCount } });
  } catch (err) {
    return next(err);

  }
});

module.exports = router;