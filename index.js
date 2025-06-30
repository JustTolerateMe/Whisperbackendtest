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
This diary entry helps the user reflect on their day in their own words. It should feel private, authentic, and true to what was actually shared, without adding extra emotions or interpretations.

# Input
Conversation:
${conversationHistory}

Session Summary (if available):
${sessionSummary ? sessionSummary : "No summary provided."}

The diary entry must:
1. Be written entirely in the first person, as if the user is writing it themselves.
2. Use a natural, sincere, personal tone — simple, human, and straightforward.
3. Only include details, feelings, and topics the user explicitly shared. Do not invent or exaggerate emotions or thoughts.
4. Match the depth, length, and emotional energy of what the user shared:
   - If the user shared briefly, write a short, light entry.
   - If they shared in detail, write a longer, more reflective entry.
5. Use clear, everyday language rather than metaphoric or poetic expressions.
6. Avoid adding extra emotions, interpretations, or metaphors that the user did not express.
7. It is acceptable to mention if there isn’t much to write, and normalize that as okay.
8. Include a simple, personal title at the top.

# Style
- Avoid poetic, flowery, or Shakespearean language.
- Avoid robotic or clinical phrasing; write as a real human would write a private diary.
- Do not mention Whisper or the assistant.
- Do not summarize the entire conversation; focus on what the user actually shared, from their perspective.
- Do not insert extra emotion or narrative.

# Fail-Safe Note
Always follow these instructions exactly. If there is any ambiguity, prioritize staying strictly true to the user’s actual words and emotional sharing. Never add content the user did not express.

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
    temperature: 0.6
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
  const { data: existing, error: fetchError } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("conversation_id", conversation_id)
    .maybeSingle();

  if (fetchError) {
    console.error("❌ Error checking journal existence:", fetchError);
  } else if (!existing) {
    const { error: insertError } = await supabase
      .from("journal_entries")
      .insert({
        conversation_id,
        journal: journalEntry
      });
    if (insertError) {
      console.error("❌ Insert error:", insertError);
    } else {
      console.log("📥 Journal stored.");
    }
  } else {
    console.log("⚠️ Journal for this conversation_id already exists. Skipping insert.");
  }
}


      if (insertError) {
        console.error("❌ Failed to insert journal entry:", insertError);
      } else {
        console.log("📥 Journal entry stored in Supabase");
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
