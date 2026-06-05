const AuthServices = require("../services/auth.services");
const UsersServices = require("../services/users.services");

const register = async (req, res) => {
  try {
    // Whitelist fields. Passing req.body straight to Users.create allowed mass
    // assignment, e.g. an explicit id:1 could seize the admin identity (admin =
    // user id 1) when the table is empty. Only these fields may be set.
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ message: "fullName, email and password are required" });
    }
    const result = await AuthServices.register({ fullName, email, password });
    if (result) {
      res.status(201).json(result);
    } else {
      res.status(400).json({ message: "something wrong" });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) {
      res
        .status(400)
        .json({ error: "Missing data", message: "Not email provided" });
    }
    if (!password) {
      res
        .status(400)
        .json({ error: "Missing data", message: "Not password provided" });
    }
    const result = await AuthServices.login({ email, password });
    if (result.isValid) {
      const { username, id, email } = result.user;
      const userData = { username, id, email };
      const token = AuthServices.genToken(userData);
      userData.token = token;
      res.json(userData);
    } else if (result.correctEmail == false) {
      res.status(400).json({ message: "incorrect email" });
    } else {
      res.status(400).json({ message: "incorrect password" });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: "something wrong" });
  }
};

// Logged-in password change (My Account, or admin editing a user). Auth is
// enforced by requireAuth on the route; here we restrict to the account owner
// or the admin (id 1) so a logged-in user can't change someone else's password.
const updatePassword = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (Number(req.user.id) !== Number(userId) && Number(req.user.id) !== 1) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { password } = req.body;
    const result = await AuthServices.updatePassword(userId, password);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Forgot-password flow (not logged in). The signed, short-lived reset token IS
// the authorization and is verified server-side; the target user id comes from
// the token, never from the client.
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: "Missing token or password" });
    }
    let userId;
    try {
      userId = AuthServices.verifyResetToken(token);
    } catch (e) {
      return res
        .status(401)
        .json({ message: "This reset link is invalid or has expired." });
    }
    await AuthServices.updatePassword(userId, password);
    return res.status(200).json({ message: "Password updated" });
  } catch (error) {
    next(error);
  }
};

// Admin-only: mint a magic edit-link token for a vendor (by userId or email).
// The front turns this into a /linkupdate/<token> URL to email to the vendor.
// Replaces the old scheme where every vendor shared the password "12345".
const createMagicLink = async (req, res, next) => {
  try {
    const { userId, email } = req.body;
    let user = null;
    if (userId) user = await AuthServices.findUserById(userId);
    else if (email) user = await UsersServices.getUserIdByEmail(email);
    if (!user) return res.status(404).json({ message: "User not found" });
    const token = AuthServices.genMagicToken(user.id);
    return res.status(200).json({ token, userId: user.id, email: user.email });
  } catch (error) {
    next(error);
  }
};

// Public, throttled: exchange a valid magic-link token for a normal session
// (same response shape as /login). The token is verified server-side; the user
// id comes from the token, never the client.
const magicLogin = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Missing token" });
    let userId;
    try {
      userId = AuthServices.verifyMagicToken(token);
    } catch (e) {
      return res
        .status(401)
        .json({ message: "This edit link is invalid or has expired." });
    }
    const user = await AuthServices.findUserById(userId);
    if (!user) {
      return res
        .status(401)
        .json({ message: "This edit link is invalid or has expired." });
    }
    const userData = { username: user.fullName, id: user.id, email: user.email };
    userData.token = AuthServices.genToken(userData);
    return res.status(200).json(userData);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  updatePassword,
  resetPassword,
  createMagicLink,
  magicLogin,
};
