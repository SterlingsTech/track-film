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
        const lat = parseFloat(r.get("Latitude"));
        const lng = parseFloat(r.get("Longitude"));
        if (!isNaN(lat) && !isNaN(lng)) {
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [lng, lat] },
            properties: {
              status: r.get("Status"),
              route: r.get("Route") || ""
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
