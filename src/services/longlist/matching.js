const { Op } = require("sequelize");
const Categories = require("../../models/categories.models");
const Companies = require("../../models/companies.models");

// Filtre des entrées DB qui ressemblent à des placeholders de seed
// (ex. "Category-5-Logo-1") ou à des noms vides · Claude n'a rien à en faire.
const PLACEHOLDER_NAME = /^(category|placeholder|test|seed)[-_\s]*\d/i;
function isRealProvider(name) {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  if (PLACEHOLDER_NAME.test(trimmed)) return false;
  return true;
}

const PROVIDER_FIELDS = [
  "id",
  "name",
  "description",
  "productName",
  "productVersion",
  "companyWebsite",
  "logo",
  "companyCategories",
];

async function getAllCategories() {
  return Categories.findAll({
    attributes: ["id", "name"],
    order: [["id", "ASC"]],
    raw: true,
  });
}

async function getCategoriesByIds(categoryIds) {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) return [];
  return Categories.findAll({
    where: { id: { [Op.in]: categoryIds } },
    attributes: ["id", "name"],
    order: [["id", "ASC"]],
    raw: true,
  });
}

/**
 * Retourne les providers de la TreasuryMap regroupés par catégorie.
 * - Filtre : live=true AND multiplayer_map=true (companies réellement sur la map)
 * - Une company appartenant à plusieurs catégories cochées apparaît dans chaque groupe
 *
 * @param {number[]} categoryIds
 * @returns {Promise<Array<{categoryId:number, categoryName:string, providers:Array}>>}
 */
async function getProvidersForCategories(categoryIds) {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) return [];

  const categories = await getCategoriesByIds(categoryIds);
  const companies = await Companies.findAll({
    where: {
      companyCategories: { [Op.overlap]: categoryIds },
      live: true,
      multiplayerMap: true,
    },
    attributes: PROVIDER_FIELDS,
    raw: true,
  });

  return categories.map((cat) => ({
    categoryId: cat.id,
    categoryName: cat.name,
    providers: companies
      .filter(
        (c) =>
          Array.isArray(c.companyCategories) &&
          c.companyCategories.includes(cat.id) &&
          isRealProvider(c.name)
      )
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description || null,
        productName: c.productName || null,
        productVersion: c.productVersion || null,
        website: c.companyWebsite || null,
        logo: c.logo || null,
      })),
  }));
}

/**
 * Renvoie la liste des providers d'UNE SEULE catégorie (Compare Tools form).
 */
async function getProvidersForSingleCategory(categoryId) {
  const result = await getProvidersForCategories([categoryId]);
  return result[0] || { categoryId, categoryName: null, providers: [] };
}

/**
 * Récupère les vendors par leurs IDs et vérifie qu'ils sont TOUS dans la
 * catégorie passée. Garantie que Compare Tools ne compare pas des hétérogènes.
 *
 * @param {number[]} vendorIds
 * @param {number} categoryId
 * @returns {Promise<{vendors:Array, missingIds:number[], wrongCatIds:number[]}>}
 */
async function getVendorsByIdsInCategory(vendorIds, categoryId) {
  if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
    return { vendors: [], missingIds: [], wrongCatIds: [] };
  }
  const companies = await Companies.findAll({
    where: { id: { [Op.in]: vendorIds }, live: true, multiplayerMap: true },
    attributes: PROVIDER_FIELDS,
    raw: true,
  });
  const foundIds = new Set(companies.map((c) => c.id));
  const missingIds = vendorIds.filter((id) => !foundIds.has(id));
  const wrongCatIds = [];
  const vendors = companies
    .filter((c) => {
      const ok = Array.isArray(c.companyCategories) && c.companyCategories.includes(categoryId);
      if (!ok) wrongCatIds.push(c.id);
      return ok && isRealProvider(c.name);
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || null,
      productName: c.productName || null,
      productVersion: c.productVersion || null,
      website: c.companyWebsite || null,
      logo: c.logo || null,
      inTreasuryMap: true,
    }));
  return { vendors, missingIds, wrongCatIds };
}

module.exports = {
  getAllCategories,
  getCategoriesByIds,
  getProvidersForCategories,
  getProvidersForSingleCategory,
  getVendorsByIdsInCategory,
};
