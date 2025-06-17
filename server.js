require('dotenv').config();
const Express = require("express");
const Airtable = require("airtable");

// Check for required environment variables
const requiredEnvVars = ['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'TABLE_NAME'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

// Initialize Express and serve static files
const app = Express();
app.use(Express.static(__dirname + "/public"));

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

// Add endpoint to list all records
app.get("/records", async (req, res) => {
  try {
    const records = await base(process.env.TABLE_NAME).select().all();
    const recordList = records.map(record => ({
      id: record.id,
      name: record.get("Customers Full Name") || "Unnamed",
      status: record.get("Package Status") || "Unknown"
    }));
    res.json(recordList);
  } catch (err) {
    console.error('Error fetching records:', err);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

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
    console.error('Error fetching record:', err);
    if (err.statusCode === 404) {
      res.status(404).json({ error: "Record not found" });
    } else if (err.statusCode === 401) {
      res.status(401).json({ error: "Unauthorized - Check your Airtable API key" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

const PORT = process.env.PORT || 3000;
const listener = app.listen(PORT, () => {
  console.log("Listening on port " + listener.address().port);
});
  