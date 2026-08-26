const express = require("express");
const router = express.Router();
const { isUuid } = require("../utils/validators")
const { pool } = require("../config/db");

// Keep static routes before dynamic /coaches/:coachId route declarations.
router.get("/coaches/skill", async (req, res, next) => {
	try {
		const result = await pool.query(
			"SELECT id, name FROM skills ORDER BY created_at",
		);


		// return res.status(200).json({ status: "success", data: result });

		return res.status(200).json({ status: "success", data: result.rows });
	} catch (err) {
		return next(err);
	}
});


router.post("/coaches/skill", async (req, res, next) => {
	const { name } = req.body;
	if (typeof name !== "string" || name.trim() === "") {
		return res.status(400).json({ status: "failed", message: "欄位未填寫正確" });
	}

	try {

		const isExistingSkill = await pool.query(
			"SELECT id, name FROM skills WHERE name = $1", [name]
		);


		if (!!isExistingSkill.rowCount) {
			return res.status(409).json({ status: "failed", message: "資料重複" });
		}


		const result = await pool.query(
			'INSERT INTO skills (name) VALUES ($1) RETURNING id, name', [name.trim()])

		return res.status(200).json({ status: "success", data: result.rows[0] });
	} catch (err) {
		return next(err);
	}
});



router.delete("/coaches/skill/:id", async (req, res, next) => {
	const { id } = req.params;
	if (!isUuid(id)) {
		return res.status(400).json({ status: "failed", message: "ID錯誤" });
	}

	try {

		const isExistingSkill = await pool.query(
			"SELECT id, name FROM skills WHERE id = $1", [id]
		);


		if (!isExistingSkill.rowCount) {
			return res.status(400).json({ status: "failed", message: "ID錯誤" });
		}


		const result = await pool.query(
			'DELETE FROM skills WHERE id = $1 RETURNING id, name', [id]
		);

		return res.status(200).json({ status: "success", data: { raw: result.rows[0], affected: result.rowCount } });
	} catch (err) {
		return next(err);
	}
});



module.exports = router;
