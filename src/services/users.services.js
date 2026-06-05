const Users = require("../models/user.models");

class UsersServices {
  static async getAllUsers() {
    try {
      // Never serialize the password hash to clients.
      const result = await Users.findAll({
        attributes: { exclude: ["password"] },
      });
      return result;
    } catch (error) {
      throw error;
    }
  }
  static async getUserIdByEmail(email) {
    try {
      const result = await Users.findOne({
        where: { email },
      });
      return result;
    } catch (error) {
      throw error;
    }
  }
  static async getUserById(id) {
    try {
      // Never serialize the password hash to clients.
      const result = await Users.findByPk(id, {
        attributes: { exclude: ["password"] },
      });
      return result;
    } catch (error) {
      throw error;
    }
  }
  static async updateUserById(id, data) {
    try {
      const result = await Users.update(data, {
        where: { id },
      });
      return result;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = UsersServices;
