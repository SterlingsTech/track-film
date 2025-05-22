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
const ll = r.get("Where was the package delivered (if it was)?") || "";
const [lat, lng] = ll.split(",").map(s => parseFloat(s.trim()));
        if (!isNaN(lat) && !isNaN(lng)) {
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [lng, lat] },
            properties: {
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
