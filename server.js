const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/camelify', async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64 || !mediaType) return res.status(400).json({ error: 'Missing image data.' });

    const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + process.env.GEMINI_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: mediaType, data: imageBase64 } },
          { text: 'Analyze this NFT profile picture in detail: background, outfit, accessories, body position, lighting, colors. Then write a FLUX image generation prompt recreating ALL details exactly but replacing the character head with a Camel Cabal style camel head (semi-realistic painted camel, warm brown fur, big expressive nose, soulful eyes). Keep everything else identical. Format: ANALYSIS: [analysis] PROMPT: [prompt]' }
        ]}]
      })
    });

    if (!geminiRes.ok) { const e = await geminiRes.json(); return res.status(500).json({ error: 'Gemini: ' + (e.error?.message || geminiRes.status) }); }

    const txt = (await geminiRes.json()).candidates?.[0]?.content?.parts?.[0]?.text;
    if (!txt) return res.status(500).json({ error: 'No response from Gemini.' });

    const match = txt.match(/PROMPT:\s*([\s\S]+)/);
    if (!match) return res.status(500).json({ error: 'No prompt extracted.' });

    const hfRes = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.HF_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: match[1].trim() + ', NFT pfp square 1:1, painted camel head, warm brown fur, Camel Cabal style' })
    });

    if (!hfRes.ok) { const e = await hfRes.text(); return res.status(500).json({ error: 'HuggingFace: ' + e }); }

    const buffer = await hfRes.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');
    const imageUrl = 'data:image/jpeg;base64,' + base64Image;

    return res.status(200).json({ imageUrl });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'Camel Cabal API running' }));
app.listen(process.env.PORT || 3000, () => console.log('Running'));
