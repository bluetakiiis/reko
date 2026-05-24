const { applyCors, handleCorsPreflight, json } = require("./_shared.js");
const { firebaseConfig } = require("../server/firebase-config.js");

module.exports = (req, res) => {
  if (handleCorsPreflight(req, res)) {
    return;
  }

  applyCors(req, res);
  res.setHeader("Cache-Control", "no-store");
  json(res, 200, firebaseConfig);
};