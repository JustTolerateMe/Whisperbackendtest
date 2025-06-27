const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON body
app.use(express.json());

// ✅ This is your webhook route!
app.post("/log-conversation", (req, res) => {
  const { user_input, agent_output, timestamp } = req.body;
  console.log("✅ Conversation received:", { user_input, agent_output, timestamp });

  res.json({
    status: "success",
    message: "Conversation logged"
  });
});

// Health check route
app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`✅ Server listening on port ${port}`);
});
