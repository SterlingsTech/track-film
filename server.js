const Express = require("express");
const Airtable = require("airtable");

// Initialize Express and serve static files
const app = Express();
app.use(Express.static("public"));

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

app.get("/data/:recId", async (req, res) => {
  const recId = req.params.recId;
  let features = [];

  try {
    // Fetch exactly one record by ID
    const record = await base(process.env.TABLE_NAME).find(recId);

    // 🔴 1. In-Transit Route (red)
    const inRoute = (record.get("InTransit Route") || "")
      .split("\n")
      .map(l => l.split(",").map(Number));
    if (inRoute.length > 1) {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: inRoute.map(([lat, lng]) => [lng, lat]) },
        properties: { event: "route_in_transit" }
      });
    }

    // 🟠 2. Tampered Route (orange)
    const tampered = (record.get("Tampered Route") || "")
      .split("\n")
      .map(l => l.split(",").map(Number));
    if (tampered.length > 1) {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: tampered.map(([lat, lng]) => [lng, lat]) },
        properties: { event: "route_tampered" }
      });
    }

    // 🟡 3. Stolen Route (yellow)
    const stolen = (record.get("Stolen Route") || "")
      .split("\n")
      .map(l => l.split(",").map(Number));
    if (stolen.length > 1) {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: stolen.map(([lat, lng]) => [lng, lat]) },
        properties: { event: "route_stolen" }
      });
    }

    // 1️⃣ Customer's Delivery Address (for zone buffers + popup info)
    const addrLL = record.get("Customers Delivery Address (GPS & What3Words)") || "";
    const [addrLat, addrLng] = addrLL.split(",").map(s => parseFloat(s.trim()));
    if (!isNaN(addrLat) && !isNaN(addrLng)) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [addrLng, addrLat] },
        properties: {
          event: "address",
          customerName: record.get("Customers Full Name") || "",
          customerAddress: record.get("Customers Delivery Address") || ""
        }
      });
    }

    // 2️⃣ Delivery Location + timestamp + photo
    const deliveredLL = record.get("Where was the package delivered (if it was)?") || "";
    const [delLat, delLng] = deliveredLL.split(",").map(s => parseFloat(s.trim()));
    if (!isNaN(delLat) && !isNaN(delLng)) {
      const deliveredTime = record.get("When was the Package delivered?") || "";
      const attachments = record.get("Proof of delivery image") || [];
      const photoUrl = attachments.length ? attachments[0].url : "";

      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [delLng, delLat] },
        properties: {
          event: "delivered",
          status: record.get("Package Status"),
          left: record.get("Who or where was the package left?") || "",
          deliveredTime,
          photoUrl
        }
      });
    }

    // 3️⃣ Opened Location + timestamp
    const openedLL = record.get("Where was the package opened (if it was)?") || "";
    const [openLat, openLng] = openedLL.split(",").map(s => parseFloat(s.trim()));
    if (!isNaN(openLat) && !isNaN(openLng)) {
      const openedTime = record.get("When was the Package opened?") || "";

      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [openLng, openLat] },
        properties: {
          event: "opened",
          status: record.get("Package Status"),
          left: record.get("Who or where was the package left?") || "",
          openedTime
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
