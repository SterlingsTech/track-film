const Express = require("express");
const Airtable = require("airtable");

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const app = Express();

app.get("/data", async (req, res) => {
  let features = [];

  await base(process.env.TABLE_NAME)
    .select({ view: "Grid view" })
    .eachPage((records, next) => {
      records.forEach(r => {
        // === DELIVERY LOCATION ===
        const deliveredLL = r.get("Where was the package delivered (if it was)?") || "";
        const [delLat, delLng] = deliveredLL.split(",").map(s => parseFloat(s.trim()));

        if (!isNaN(delLat) && !isNaN(delLng)) {
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [delLng, delLat] },
            properties: {
              type: "delivered",
              status: r.get("Package Status"),
              left: r.get("Who or where was the package left?") || ""
            }
          });
        }

        // === OPENED LOCATION ===
        const openedLL = r.get("Where was the package opened (if it was)?") || "";
        const [openLat, openLng] = openedLL.split(",").map(s => parseFloat(s.trim()));

        if (!isNaN(openLat) && !isNaN(openLng)) {
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [openLng, openLat] },
            properties: {
              type: "opened",
              status: r.get("Package Status"),
              left: r.get("Who or where was the package left?") || ""
            }
          });
        }
      });
      next();
    });

  res.json({ type: "FeatureCollection", features });
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Listening on port " + listener.address().port);
});
