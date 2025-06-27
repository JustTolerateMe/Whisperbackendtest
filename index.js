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

// Updated webhook route for complete conversations
app.post("/log-conversation", (req, res) => {
  try {
    const { conversation_history, session_summary, timestamp, user_readiness } = req.body;
    
    console.log("📝 Complete conversation received:", {
      timestamp,
      session_summary: session_summary ? session_summary.substring(0, 100) + "..." : "No summary",
      conversation_length: conversation_history ? conversation_history.length : 0,
      user_readiness,
      received_at: new Date().toISOString()
    });
    
    // Log the full conversation history (truncated for readability)
    if (conversation_history) {
      console.log("💬 Conversation History:");
      console.log(conversation_history.substring(0, 500) + "...");
    }
    
    // Store the complete conversation data
    const sessionData = {
      conversation_history,
      session_summary,
      timestamp,
      user_readiness,
      received_at: new Date().toISOString(),
      ready_for_journal: true
    };
    
    // TODO: Here you can add ChatGPT integration or database storage
    // Example: await generateJournalEntry(sessionData);
    // Example: await saveToDatabase(sessionData);
    
    console.log("✅ Session data prepared for journal generation");
    
    res.status(200).json({ 
      status: "success", 
      message: "Complete conversation logged successfully",
      session_info: {
        timestamp: sessionData.received_at,
        conversation_length: conversation_history ? conversation_history.length : 0,
        has_summary: !!session_summary,
        ready_for_journal: true
      }
    });
    
  } catch (error) {
    console.error("❌ Error processing conversation:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to process conversation",
      error: error.message
    });
  }
});

// Endpoint to manually trigger journal generation (for testing)
app.post("/generate-journal", (req, res) => {
  const { conversation_history, session_summary } = req.body;
  
  if (!conversation_history) {
    return res.status(400).json({
      status: "error",
      message: "conversation_history is required"
    });
  }
  
  console.log("📖 Journal generation requested");
  
  // TODO: Add ChatGPT integration here
  // const journalEntry = await generateJournalWithChatGPT(conversation_history, session_summary);
  
  res.json({
    status: "success",
    message: "Journal generation initiated",
    data: {
      conversation_length: conversation_history.length,
      summary_provided: !!session_summary,
      // journal_entry: journalEntry // Uncomment when ChatGPT integration is added
    }
  });
});

// Health check route
app.get("/", (req, res) => {
  res.json({
    status: "WhisperLog Backend Running",
    service: "Voice Journaling API",
    timestamp: new Date().toISOString(),
    endpoints: {
      "POST /log-conversation": "Receive complete conversation from ElevenLabs",
      "POST /generate-journal": "Manual journal generation",
      "GET /": "Health check"
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("❌ Unhandled error:", error);
  res.status(500).json({
    status: "error",
    message: "Internal server error"
  });
});

app.listen(port, () => {
  console.log(`✅ WhisperLog Backend listening on port ${port}`);
  console.log(`🎤 Ready to receive voice journal conversations`);
});
