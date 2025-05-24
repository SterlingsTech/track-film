// … your existing requires, base init, etc.

app.get("/data/:recId", async (req, res) => {
  const recId = req.params.recId;
  let features = [];

  // Fetch exactly that one record
  await base(process.env.TABLE_NAME)
    .find(recId)
    .then(r => {
      // === DELIVERY LOCATION ===
      const deliveredLL = r.get("Where was the package delivered (if it was)?") || "";
      const [delLat, delLng] = deliveredLL.split(",").map(s => parseFloat(s.trim()));
      if (!isNaN(delLat) && !isNaN(delLng)) {
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [delLat, delLng] },
          properties: {
            event: "delivered",
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
          geometry: { type: "Point", coordinates: [openLat, openLng] },
          properties: {
            event: "opened",
            status: r.get("Package Status"),
            left: r.get("Who or where was the package left?") || ""
          }
        });
      }
      // === DELIVERY ADDRESS (initial) ===
      const addrLL = r.get("Customers Delivery Address") || "";
      // if you’ve geocoded this into lat/lng fields, use those instead
      // optional: include the drop-off zone center
    })
    .catch(err => {
      return res.status(404).json({ error: "Record not found" });
    });

  res.json({ type: "FeatureCollection", features });
});
