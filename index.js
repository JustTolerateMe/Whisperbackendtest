const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.post("/log-conversation", (req, res) => {
  const { user_input, agent_output, timestamp } = req.body;
  console.log("Conversation logged:", { user_input, agent_output, timestamp });

  res.json({ status: "success", message: "Conversation logged" });
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
