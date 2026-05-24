const {
  ADMIN_SESSION_TTL_MS,
  applyCors,
  buildSessionCookie,
  handleCorsPreflight,
  json,
  parseBody,
  signSessionToken,
  validatePuzzlePayload,
  verifyFirebaseBearerToken,
} = require("../_shared.js");

module.exports = async (req, res) => {
  if (handleCorsPreflight(req, res)) {
    return;
  }

  applyCors(req, res);

  try {
    const decoded = await verifyFirebaseBearerToken(req);

    if (decoded.firebase?.sign_in_provider !== "anonymous") {
      json(res, 403, { error: "Anonymous Firebase auth required." });
      return;
    }

    if (!validatePuzzlePayload(parseBody(req))) {
      json(res, 403, { error: "Puzzle solution was not accepted." });
      return;
    }

    const now = Date.now();
    const sessionValue = signSessionToken({
      uid: decoded.uid,
      provider: decoded.firebase?.sign_in_provider || "anonymous",
      exp: now + ADMIN_SESSION_TTL_MS,
      iat: now,
    });

    res.setHeader(
      "Set-Cookie",
      buildSessionCookie(sessionValue, ADMIN_SESSION_TTL_MS),
    );
    json(res, 200, { ok: true, authorized: true, uid: decoded.uid });
  } catch (error) {
    console.error("Failed to unlock admin mode:", error);
    json(res, 401, { error: "Unable to unlock admin mode." });
  }
};