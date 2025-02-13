const SubOptionsServices = require("../services/subOptions.services");

const getAllSubOptions = async (req, res, next) => {
  try {
    const result = await SubOptionsServices.getAllSubOptions();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSubOptions,
};
