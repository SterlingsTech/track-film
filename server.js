const Express = require("express");
const Airtable = require("airtable");

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const app = Express();

app.get("/data/:recId", async (req, res) => {
  const recId = req.params.recId;
  let features = [];

  try {
    // Fetch exactly one record by ID
    const record = await base(process.env.TABLE_NAME).find(recId);

    // 1️⃣ Customer's Delivery Address (for zone buffers)
    const addrLL = record.get("Customers Delivery Address (GPS & What3Words)") || "";
    const [addrLat, addrLng] = addrLL
      .split(",")
      .map(s => parseFloat(s.trim()));
    if (!isNaN(addrLat) && !isNaN(addrLng)) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [addrLat, addrLng] },
        properties: {
          event: "address",
          status: record.get("Package Status"),
          left: record.get("Who or where was the package left?") || ""
        }
      });
    }

    // 2️⃣ Delivery Location
    const deliveredLL = record.get("Where was the package delivered (if it was)?") || "";
    const [delLat, delLng] = deliveredLL
      .split(",")
      .map(s => parseFloat(s.trim()));
    if (!isNaN(delLat) && !isNaN(delLng)) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [delLat, delLng] },
        properties: {
          event: "delivered",
          status: record.get("Package Status"),
          left: record.get("Who or where was the package left?") || ""
        }
      });
    }

    // 3️⃣ Opened Location
    const openedLL = record.get("Where was the package opened (if it was)?") || "";
    const [openLat, openLng] = openedLL
      .split(",")
      .map(s => parseFloat(s.trim()));
    if (!isNaN(openLat) && !isNaN(openLng)) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [openLat, openLng] },
        properties: {
          event: "opened",
          status: record.get("Package Status"),
          left: record.get("Who or where was the package left?") || ""
        }
      });
    }

    // Return the GeoJSON FeatureCollection
    res.json({ type: "FeatureCollection", features });
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: "Record not found" });
  }
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Listening on port " + listener.address().port);
});
