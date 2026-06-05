const Users = require("../models/user.models");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require("dotenv").config();

class AuthServices {
  static async register(user) {
    try {
      const result = await Users.create(user);
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async login(field) {
    try {
      const { email, password } = field;
      const user = await Users.findOne({
        where: { email },
      });
      if (user) {
        const isValid = bcrypt.compareSync(password, user.password);
        return isValid ? { isValid, user } : { isValid };
      }
      return { correctEmail: false };
    } catch (error) {
      throw error;
    }
  }

  static genToken(data, expiresIn = "7d") {
    try {
      const token = jwt.sign(data, process.env.JWT_SECRET, {
        algorithm: "HS512",
        expiresIn,
      });
      return token;
    } catch (error) {
      throw error;
    }
  }

  // Verify a password-reset token server-side. The token is signed with
  // JWT_SECRET and scoped with purpose:"reset" so a session token can't be
  // used to reset (and vice-versa). Throws if invalid/expired/wrong purpose.
  // Returns the target user id (never trust a client-decoded id).
  static verifyResetToken(token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS512"],
    });
    if (decoded.purpose !== "reset") throw new Error("Not a reset token");
    // userId is a plain id (we no longer embed the full user record, which
    // would leak the bcrypt hash and email inside the emailed link).
    const id = decoded.userId;
    if (!id) throw new Error("Malformed reset token");
    return id;
  }

  // Mint a long-lived, single-purpose "magic" edit link for a vendor. The
  // signed token IS the credential (replaces the old shared 12345 password).
  // 30 days; admin re-issues as needed. Rotating JWT_SECRET invalidates all.
  static genMagicToken(userId) {
    return AuthServices.genToken({ userId, purpose: "magic" }, "30d");
  }

  // Verify a magic edit-link token server-side. Throws if invalid/expired/wrong
  // purpose. Returns the target user id (the token carries only a plain id).
  static verifyMagicToken(token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS512"],
    });
    if (decoded.purpose !== "magic") throw new Error("Not a magic token");
    const id = decoded.userId;
    if (!id) throw new Error("Malformed magic token");
    return id;
  }

  static async findUserById(id) {
    return Users.findByPk(id);
  }

  static async updatePassword(id, password) {
    try {
      const result = await Users.update(
        { password: password },
        { where: { id }, individualHooks: true }
      );
      return result;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AuthServices;
