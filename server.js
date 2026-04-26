const express = require(‘express’);
const cors = require(‘cors’);

const app = express();
app.use(cors());
app.use(express.json({ limit: ‘10mb’ }));

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const REPLICATE_KEY = process.env.REPLICATE_KEY;

app.post(’/camelify’, async (req, res) => {
try {
const { imageBase64, mediaType } = req.body;
if (!imageBase64 || !mediaType) {
return res.status(400).json({ error: ‘Missing image data.’ });
}
// Step 1: Analyze with Claude
const analyzeRes = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': ANTHROPIC_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: 'Analyze this NFT pfp in detail: background, outfit, accessories, body position, lighting, colors. Then write a FLUX image generation prompt recreating ALL details exactly but replacing the character head with a Camel Cabal style camel head (semi-realistic painted camel, warm brown fur, big expressive nose, soulful eyes). Keep everything else identical. Format: ANALYSIS: [analysis] PROMPT: [prompt]' }
      ]
    }]
  })
});

if (!analyzeRes.ok) {
  const e = await analyzeRes.json();
  return res.status(500).json({ error: 'Claude: ' + (e.error?.message || analyzeRes.status) });
}

const analyzeData = await analyzeRes.json();
const fullText = analyzeData.content[0].text;
const promptMatch = fullText.match(/PROMPT:\s*([\s\S]+)/);
if (!promptMatch) return res.status(500).json({ error: 'Could not extract prompt.' });
const imagePrompt = promptMatch[1].trim();

// Step 2: Generate with Replicate
const replicateRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${REPLICATE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'wait'
  },
  body: JSON.stringify({
    input: {
      prompt: imagePrompt + ', NFT pfp, square 1:1, semi-realistic painted camel head, warm brown fur, expressive face, Camel Cabal NFT style',
      num_outputs: 1,
      aspect_ratio: '1:1',
      output_format: 'webp',
      num_inference_steps: 4
    }
  })
});

if (!replicateRes.ok) {
  const e = await replicateRes.json();
  return res.status(500).json({ error: 'Replicate: ' + (e.detail || replicateRes.status) });
}

const repData = await replicateRes.json();
let imageUrl = repData.output?.[0];

if (!imageUrl && repData.urls?.get) {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const poll = await fetch(repData.urls.get, {
      headers: { 'Authorization': `Bearer ${REPLICATE_KEY}` }
    });
    const pd = await poll.json();
    if (pd.status === 'succeeded' && pd.output?.[0]) { imageUrl = pd.output[0]; break; }
    if (pd.status === 'failed') return res.status(500).json({ error: 'Generation failed.' });
  }
}

if (!imageUrl) return res.status(500).json({ error: 'Timed out.' });
return res.status(200).json({ imageUrl });

} catch (err) {
console.error(err);
return res.status(500).json({ error: err.message });
}
});

app.get(’/’, (req, res) => res.json({ status: ‘Camel Cabal API running 🐪’ }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
