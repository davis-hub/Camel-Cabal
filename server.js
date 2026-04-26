const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/camelify', async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64 || !mediaType) return res.status(400).json({ error: 'Missing image data.' });

    const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=' + process.env.GEMINI_KEY, {
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

    const replicateRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.REPLICATE_KEY, 'Content-Type': 'application/json', 'Prefer': 'wait' },
      body: JSON.stringify({ input: { prompt: match[1].trim() + ', NFT pfp square 1:1, painted camel head, warm brown fur, Camel Cabal style', num_outputs: 1, aspect_ratio: '1:1', output_format: 'webp', num_inference_steps: 4 } })
    });

    if (!replicateRes.ok) { const e = await replicateRes.json(); return res.status(500).json({ error: 'Replicate: ' + (e.detail || replicateRes.status) }); }

    const repData = await replicateRes.json();
    let imageUrl = repData.output?.[0];

    if (!imageUrl && repData.urls?.get) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const pd = await (await fetch(repData.urls.get, { headers: { 'Authorization': 'Bearer ' + process.env.REPLICATE_KEY } })).json();
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

app.get('/', (req, res) => res.json({ status: 'Camel Cabal API running' }));
app.listen(process.env.PORT || 3000, () => console.log('Running'));
