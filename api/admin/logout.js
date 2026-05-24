const {
  ADMIN_SESSION_COOKIE,
  applyCors,
  handleCorsPreflight,
  json,
} = require("../_shared.js");

module.exports = (req, res) => {
  if (handleCorsPreflight(req, res)) {
    return;
  }

  applyCors(req, res);

  const parts = [
    `${ADMIN_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  res.setHeader("Set-Cookie", parts.join("; "));
  json(res, 200, { ok: true });
};