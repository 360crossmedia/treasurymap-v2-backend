const AuthServices = require("../services/auth.services");

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

module.exports = {
  register,
  login,
  updatePassword,
  resetPassword,
};
