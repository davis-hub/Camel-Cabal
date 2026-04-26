prompt: imagePrompt + ', NFT profile picture, square 1:1 format, semi-realistic digital painting, expressive camel head with warm brown fur and big nose, painterly brush strokes, high detail, Camel Cabal NFT aesthetic',
          num_outputs: 1,
          aspect_ratio: '1:1',
          output_format: 'webp',
          num_inference_steps: 4
        }
      })
    });

    if (!replicateRes.ok) {
      const err = await replicateRes.json();
      return res.status(500).json({ error: 'Replicate error: ' + (err.detail || replicateRes.status) });
    }

    const replicateData = await replicateRes.json();
    let imageUrl = replicateData.output?.[0];

    if (!imageUrl && replicateData.urls?.get) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(replicateData.urls.get, {
          headers: { 'Authorization': Bearer ${REPLICATE_KEY} }
        });
        const pollData = await poll.json();
        if (pollData.status === 'succeeded' && pollData.output?.[0]) {
          imageUrl = pollData.output[0];
          break;
        }
        if (pollData.status === 'failed') {
          return res.status(500).json({ error: 'Image generation failed.' });
        }
      }
    }

    if (!imageUrl) return res.status(500).json({ error: 'Timed out waiting for image.' });

    return res.status(200).json({ imageUrl });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
