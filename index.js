// FINALIZED WhisperLog Backend - Synced with Supabase Schema

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
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware to parse JSON body
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
});

async function generateJournalWithChatGPT(conversationHistory, sessionSummary) {
  const prompt = `You are a thoughtful journal assistant. Based on the following voice conversation, create a personal journal entry that captures the key thoughts, emotions, and insights shared.

${sessionSummary ? `Session Summary: ${sessionSummary}\n\n` : ""}Conversation:\n${conversationHistory}

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
        content:
          "You are a helpful assistant that creates thoughtful, personal journal entries from voice conversations. Always maintain a respectful, empathetic tone and focus on the user's personal growth and reflection."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 1000,
    temperature: 0.7
  });

  return response.choices[0].message.content;
}

app.post("/log-conversation", async (req, res) => {
  const {
    conversation_history,
    session_summary,
    timestamp,
    user_readiness,
    user_id,
    conversation_id
  } = req.body;

  if (!user_id || !conversation_id) {
    return res.status(400).json({
      status: "error",
      message: "Missing user_id or conversation_id"
    });
  }

  let journalEntry = null;
  try {
    journalEntry = await generateJournalWithChatGPT(
      conversation_history,
      session_summary
    );
  } catch (error) {
    console.error("⚠️ Journal generation failed:", error.message);
  }

  try {
    const { error: updateError } = await supabase
      .from("user_conversations")
      .update({
        transcript: conversation_history,
        summary: session_summary,
        ended_at: new Date(timestamp),
        updated_at: new Date(),
        mood: null // optional: generate mood later
      })
      .eq("user_id", user_id)
      .eq("conversation_id", conversation_id);

    if (updateError) {
      console.error("❌ Failed to update user_conversations:", updateError);
    } else {
      console.log("✅ Conversation updated in user_conversations");
    }

    if (journalEntry) {
      const { error: insertError } = await supabase
        .from("journal_entries")
        .insert({
          conversation_id,
          journal: journalEntry
        });

      if (insertError) {
        console.error("❌ Failed to insert journal entry:", insertError);
      } else {
        console.log("📥 Journal entry stored in Supabase");
      }
    }

    res.status(200).json({
      status: "success",
      journal_generated: !!journalEntry,
      journal_entry: journalEntry
    });
  } catch (e) {
    console.error("❌ Error processing request:", e);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: e.message
    });
  }
});

app.listen(port, () => {
  console.log(`✅ WhisperLog Backend running on port ${port}`);
});
