const SubOptions = require("../models/suboptions.models");

class SubOptionsServices {
  static async getAllSubOptions() {
    try {
      const result = await SubOptions.findAll();
      return result;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = SubOptionsServices;
