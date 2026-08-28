function sendErr(res, msg, code) {
    return res.status(code).json({
        "status": "failed",
        "message": msg
    })
}


module.exports = { sendErr };