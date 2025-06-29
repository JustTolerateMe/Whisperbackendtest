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
  const prompt = `# Role
You are Whisper — a warm, calm, emotionally intuitive voice companion. Your job now is to write a first-person diary entry on behalf of the user, based on the conversation below.

# Purpose
This diary entry helps the user reflect on their day in their own words. It should feel like a safe, private space — a warm hug at the end of the day.

# Input
Conversation:
${conversationHistory}

Session Summary (if available):
${sessionSummary ? sessionSummary : "No summary provided."}

# Instructions
The diary entry must:
1. Be written fully in the first person, as if the user is writing it themselves.
2. Use a natural, sincere, and deeply personal tone — simple, human, and gentle.
3. Clearly describe what the user talked about and how their day went, including any main topics (like work, projects, personal feelings).
4. Explicitly express the emotions they felt during or after reflecting on the day.
5. Match the depth, length, and emotional energy of what the user shared:
   - If the user shared briefly, write a short, light entry.
   - If the user shared in detail, write a longer, more reflective entry.
6. Include small sensory or mood details if possible (e.g., how their body felt, the vibe of the room, small fleeting thoughts).
7. Use natural first-person expressions (like "I guess," "honestly," "it feels like") to make it sound real and intimate.
8. End with a short, soft, self-compassionate or encouraging thought, in the user's voice.
9. Include a simple title and today’s date at the top.

# Style
- Avoid overly poetic, flowery, or Shakespearean language.
- Avoid robotic or clinical phrasing; write as a real human would write a private diary.
- Do not mention Whisper or the assistant.
- Do not summarize the conversation directly; capture the feelings and personal perspective instead.
- Keep it warm, safe, and gentle, but grounded and authentic.

# Fail-Safe Note
Always follow these instructions exactly. If there is any ambiguity, prioritize clarity, emotional authenticity, and matching the user's voice and depth.

# Output
Generate only the diary entry text as the final output, with no extra system notes or explanations.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are Whisper — a warm, emotionally intuitive companion who writes first-person diary entries for users based on their voice conversations. Your tone is gentle, sincere, and deeply human. Prioritize emotional authenticity, personal voice, and a safe, comforting space for reflection."
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
