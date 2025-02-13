const Categories = require("../models/categories.models");
const SubOptions = require("../models/suboptions.models");

class CategoriesServices {
  static async getAllCategories() {
    try {
      const result = await Categories.findAll({
        include: [
          {
            model: SubOptions,
            separate: true,
            order: [["id", "ASC"]],
          },
        ],
        order: [["id", "ASC"]],
      });
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async getCategoryById(id) {
    try {
      const result = await Categories.findByPk(id, {
        include: [
          {
            model: SubOptions,
            separate: true,
            order: [["id", "ASC"]],
          },
        ],
      });
      return result;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CategoriesServices;
