const {
  applyCors,
  getCookieValue,
  handleCorsPreflight,
  json,
  ADMIN_SESSION_COOKIE,
  verifySessionToken,
} = require("../_shared.js");

module.exports = (req, res) => {
  if (handleCorsPreflight(req, res)) {
    return;
  }

  applyCors(req, res);

  const session = verifySessionToken(
    getCookieValue(req.headers.cookie || "", ADMIN_SESSION_COOKIE),
  );

  if (!session) {
    json(res, 200, { ok: false, authorized: false });
    return;
  }

  json(res, 200, { ok: true, authorized: true, uid: session.uid });
};