const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON body
app.use(express.json());

// Add logging middleware to see all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Your webhook route
app.post("/log-conversation", (req, res) => {
  const { user_input, agent_output, timestamp } = req.body;
  
  console.log("✅ Conversation received:", { 
    user_input, 
    agent_output, 
    timestamp 
  });
  
  // Send a proper response
  res.status(200).json({ 
    status: "success", 
    message: "Conversation logged successfully",
    received_data: { user_input, agent_output, timestamp }
  });
});

// Health check route
app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`✅ Server listening on port ${port}`);
});
