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
          { text: 'Analyze this NFT profile picture in extreme detail: exact background colors and environment, every clothing item with colors and brands, all accessories, body position, lighting direction, color palette. Then write a detailed Stable Diffusion prompt that recreates EVERYTHING exactly but replaces the character head with a Camel Cabal NFT style camel head. The camel head must be: semi-realistic digital painting style, warm sandy brown fur with detailed texture, large soulful expressive eyes, big bulbous nose, slightly smug or characterful expression, painterly brush strokes, same lighting as original. Keep body, outfit, background 100% identical. Format: ANALYSIS: [analysis] PROMPT: [prompt]' }
        ]}]
      })
    });

    if (!geminiRes.ok) { const e = await geminiRes.json(); return res.status(500).json({ error: 'Gemini: ' + (e.error?.message || geminiRes.status) }); }

    const txt = (await geminiRes.json()).candidates?.[0]?.content?.parts?.[0]?.text;
    if (!txt) return res.status(500).json({ error: 'No response from Gemini.' });

    const match = txt.match(/PROMPT:\s*([\s\S]+)/);
    if (!match) return res.status(500).json({ error: 'No prompt extracted.' });

    const finalPrompt = match[1].trim() + ', semi-realistic digital painting, camel head with warm sandy brown fur, large expressive eyes, big bulbous nose, smug characterful expression, painterly brush strokes, detailed fur texture, NFT profile picture square format, high quality illustration, same lighting and background as original';

    const hfRes = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.HF_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: finalPrompt })
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
