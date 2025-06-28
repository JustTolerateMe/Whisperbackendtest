const express = require("express");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

// Supabase client setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Express setup
const app = express();
const port = process.env.PORT || 3000;

// OpenAI client setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


// Middleware to parse JSON body
app.use(express.json());

// Add logging middleware to see all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Function to generate journal entry using ChatGPT
async function generateJournalWithChatGPT(conversationHistory, sessionSummary) {
  try {
    console.log("🤖 Generating journal entry with ChatGPT...");
    
    const prompt = `You are a thoughtful journal assistant. Based on the following voice conversation, create a personal journal entry that captures the key thoughts, emotions, and insights shared.

${sessionSummary ? `Session Summary: ${sessionSummary}\n\n` : ''}

Conversation:
${conversationHistory}

Please create a journal entry that:
1. Captures the main themes and emotions
2. Reflects on any insights or realizations
3. Notes any goals or intentions mentioned
4. Uses a personal, reflective tone
5. Is structured and easy to read
6. Includes a meaningful title

Format the response as a proper journal entry with a title and date.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates thoughtful, personal journal entries from voice conversations. Always maintain a respectful, empathetic tone and focus on the user's personal growth and reflection."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    const journalEntry = response.choices[0].message.content;
    console.log("✅ Journal entry generated successfully");
    return journalEntry;

  } catch (error) {
    console.error("❌ Error generating journal entry:", error);
    throw new Error(`Journal generation failed: ${error.message}`);
  }
}

// Updated webhook route for complete conversations
app.post("/log-conversation", async (req, res) => {
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
    
    // Generate journal entry with ChatGPT
    let journalEntry = null;
    try {
      journalEntry = await generateJournalWithChatGPT(conversation_history, session_summary);
      console.log("📖 Journal entry created");
    } catch (journalError) {
      console.error("⚠️ Journal generation failed, but conversation logged:", journalError.message);
    }
    
    const responseData = {
      ...sessionData,
      journal_entry: journalEntry,
      journal_generated: !!journalEntry
    };
    
    let sessionInsert;
try {
  const { data, error } = await supabase
    .from("voice_sessions")
    .insert({
      timestamp,
      conversation_history,
      session_summary,
      user_readiness
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Failed to insert into voice_sessions:", error);
  } else {
    sessionInsert = data;
    console.log("✅ Session stored in Supabase:", sessionInsert.id);
  }
} catch (supabaseError) {
  console.error("❌ Supabase error:", supabaseError.message);
}

    // await saveToDatabase(responseData);
    
    console.log("✅ Session processed successfully");
    
    res.status(200).json({ 
      status: "success", 
      message: "Complete conversation processed successfully",
      session_info: {
        timestamp: sessionData.received_at,
        conversation_length: conversation_history ? conversation_history.length : 0,
        has_summary: !!session_summary,
        journal_generated: !!journalEntry,
        ready_for_journal: true
      },
      journal_entry: journalEntry
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
app.post("/generate-journal", async (req, res) => {
  const { conversation_history, session_summary } = req.body;
  
  if (!conversation_history) {
    return res.status(400).json({
      status: "error",
      message: "conversation_history is required"
    });
  }
  
  console.log("📖 Manual journal generation requested");
  
  try {
    const journalEntry = await generateJournalWithChatGPT(conversation_history, session_summary);
    // Save journal to Supabase
  if (journalEntry && sessionInsert?.id) {
  try {
    await supabase.from("journal_entries").insert({
      session_id: sessionInsert.id,
      journal: journalEntry
    });
    console.log("📥 Journal entry stored in Supabase");
  } catch (insertError) {
    console.error("❌ Failed to insert journal entry:", insertError.message);
  }
}

}

  
    
    res.json({
      status: "success",
      message: "Journal generated successfully",
      data: {
        conversation_length: conversation_history.length,
        summary_provided: !!session_summary,
        journal_entry: journalEntry
      }
    });
  } catch (error) {
    console.error("❌ Manual journal generation failed:", error);
    res.status(500).json({
      status: "error",
      message: "Journal generation failed",
      error: error.message
    });
  }
});

// New endpoint to get journal entry by ID (for future database integration)
app.get("/journal/:id", (req, res) => {
  // TODO: Implement database lookup
  res.json({
    status: "info",
    message: "Database integration pending",
    requested_id: req.params.id
  });
});

// Health check route
app.get("/", (req, res) => {
  res.json({
    status: "WhisperLog Backend Running",
    service: "Voice Journaling API",
    timestamp: new Date().toISOString(),
    features: {
      voice_logging: "✅ Active",
      chatgpt_integration: process.env.OPENAI_API_KEY ? "✅ Configured" : "❌ Missing API Key",
      database: "⏳ Pending"
    },
    endpoints: {
      "POST /log-conversation": "Receive complete conversation from ElevenLabs + Generate journal",
      "POST /generate-journal": "Manual journal generation",
      "GET /journal/:id": "Retrieve journal entry by ID",
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
  console.log(`🤖 ChatGPT integration: ${process.env.OPENAI_API_KEY ? '✅ Ready' : '❌ API key missing'}`);
});
