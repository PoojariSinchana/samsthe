const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");
const upload = require("../middleware/upload");
const items = require("../controllers/itemcontroller");
const cats = require("../controllers/categorycontroller");

// Mount at /api/catalog. One place for menu dishes, shop products, ingredients, categories and brands.
// Everyone logged in can read (POS needs it); only owner/manager can change.
router.use(protect);
const manage = authorize("owner", "manager");

// Items: GET /items?type=menu|product|ingredient
router.get("/items", items.getItems);
router.get("/items/lookup", items.lookupByCode);                 // before "/items/:id"
router.post("/items/upload-image", manage, upload.single("image"), items.uploadImage);
router.get("/items/:id", items.getItemById);
router.post("/items", manage, items.createItem);
router.put("/items/:id", manage, items.updateItem);
router.patch("/items/:id/availability", manage, items.toggleAvailability);
router.delete("/items/:id", manage, items.deleteItem);
router.post("/items/:id/addons", manage, items.addAddOn);
router.delete("/items/:id/addons/:addOnId", manage, items.removeAddOn);

// Categories: GET /categories?kind=menu|product|ingredient
router.get("/categories", cats.getCategories);
router.post("/categories", manage, cats.createCategory);
router.put("/categories/:id", manage, cats.updateCategory);
router.delete("/categories/:id", manage, cats.deleteCategory);

// Brands
router.get("/brands", cats.getBrands);
router.post("/brands", manage, upload.single("logo"), cats.createBrand);
router.put("/brands/:id", manage, upload.single("logo"), cats.updateBrand);
router.delete("/brands/:id", manage, cats.deleteBrand);

module.exports = router;