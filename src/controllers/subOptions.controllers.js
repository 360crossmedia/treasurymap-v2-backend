const SubOptionsServices = require("../services/subOptions.services");

const getAllSubOptions = async (req, res, next) => {
  try {
    const result = await SubOptionsServices.getAllSubOptions();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const uploadSubOptions = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { selectedSubOptions } = req.body;
    console.log(selectedSubOptions);
    const result = await SubOptionsServices.uploadSubOptions(
      companyId,
      selectedSubOptions
    );
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getSubOptionsByCompanyId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await SubOptionsServices.getSubOptionsByCompanyId(id);
    if (result) {
      return res.status(200).json(result);
    } else if (!result) {
      return res.status(400).json({ message: "SubOptions not found" });
    }
  } catch (error) {
    next(error);
  }
};

const getSingleSubOptionById = (req, res, next) => {
  try {
    const { idd } = req.params;
    const result = SubOptionsServices.getSingleSubOptionById(idd);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSubOptions,
  uploadSubOptions,
  getSubOptionsByCompanyId,
  getSingleSubOptionById,
};
