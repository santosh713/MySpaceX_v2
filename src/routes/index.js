const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.render("home", { title: "MySpaceX" });
});


// Example placeholder pages (optional):
router.get("/feature/:id", (req, res) => {
  const { id } = req.params;
  res.render("home", { title: `Feature ${id} – Coming Soon` }); // reuse home for now
});
// NEW
router.get("/hoursTracker", (req, res) => {
  res.render("hoursTracker", { title: "HoursTracker – MySpaceX" });
});


router.get("/paycalculator", (req,res)=>{
  res.render("paycalculator", { title:"Pay Calculator – MySpaceX" });
});


module.exports = router;
