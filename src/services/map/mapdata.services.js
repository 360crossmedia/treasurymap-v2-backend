const categoriesTemplate = require("./categoriesTemplate.js");

const SITE_URL = process.env.PUBLIC_SITE_URL || "https://treasurymap-v2-production.up.railway.app";

// Generate a URL-friendly slug from a company name (mirrors front-end slugify.js)
function slugify(input) {
  if (!input) return "";
  return String(input)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

// Function to fetch company data
async function fetchCompanies() {
    try {
        const response = await fetch('https://treasurymapbackend-production.up.railway.app/api/v1/companies');
        const data = await response.json();
        return data; // Return the fetched data
    } catch (error) {
        console.error('Error fetching company data:', error);
        return []; // Return an empty array in case of an error
    }
}

// Function to process categories after fetching companies
async function processCategories() {
    try {

        let categories = JSON.parse(JSON.stringify(categoriesTemplate));
        let companies = []; // Initialize an empty array        

        companies = await fetchCompanies(); // Await the fetch operation

        categories.forEach(category => {
            companies.forEach(company => {
                if (company.companyCategories && company.companyCategories.includes(category.id + 1)) {
                    category.logos.push(
                        {
                            image: company.logo || '',
                            url: slugify(company.name)
                              ? `${SITE_URL}/providers/${slugify(company.name)}`
                              : `${SITE_URL}/companyPage/${company.id}`,
                            keywords: company.keywords || [],
                            subcategories: company.companySubcategories || [],
                            headequarterLocation: company.location || '',
                            activeIn: company.companyOffices || [],
                            live: company.live
                        }
                    ); // Store company data
                }
            });
        });

        //console.log(categories); // Now categories is processed and can be logged
        return categories
    } catch (error) {
        console.error('Error processing categories:', error);
    }
}

module.exports = {
  processCategories,
};