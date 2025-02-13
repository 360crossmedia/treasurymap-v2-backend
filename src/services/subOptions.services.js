const SubOptions = require("../models/suboptions.models");
const CompanyCategorySubOption = require("../models/companyCategorySubOption.models");

class SubOptionsServices {
  static async getAllSubOptions() {
    try {
      const result = await SubOptions.findAll();
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async uploadSubOptions(companyId, selectedSubOptions) {
    try {
      await CompanyCategorySubOption.destroy({
        where: { company_id: companyId },
      });

      for (const [categoryId, subOptionId] of Object.entries(
        selectedSubOptions
      )) {
        await CompanyCategorySubOption.create({
          companyId,
          categoryId,
          subOptionId,
        });
      }
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async getSubOptionsByCompanyId(companyId) {
    try {
      const result = await CompanyCategorySubOption.findAll({
        where: { company_id: companyId },
      });
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async getSingleSubOptionById(id) {
    try {
      const result = await SubOptions.findAll();
      return result;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = SubOptionsServices;
