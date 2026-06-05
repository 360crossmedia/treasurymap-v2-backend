const UsersServices = require("../services/users.services");

const getAllUsers = async (req, res, next) => {
  try {
    const result = await UsersServices.getAllUsers();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Only the owner of the record or the admin (id 1) may read a user.
    if (Number(req.user.id) !== Number(id) && Number(req.user.id) !== 1) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const result = await UsersServices.getUserById(id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Only the account owner or the admin (id 1) may update a user.
    if (Number(req.user.id) !== Number(id) && Number(req.user.id) !== 1) {
      return res.status(403).json({ message: "Forbidden" });
    }
    // Whitelist editable fields (prevents mass-assignment of id and others).
    // Password is intentionally excluded: it must go through
    // POST/PUT /auth/* which hashes via individualHooks; the bulk update here
    // would store it in plaintext.
    const { fullName, email } = req.body;
    const data = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (email !== undefined) data.email = email;
    const result = await UsersServices.updateUserById(id, data);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserById,
};
