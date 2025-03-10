const express = require('express');
const axios = require('axios');
const spotify = require('./spotify');
const router = express.Router();

async function getSuggestions(input, songCount, exclude = []) {
  try {
    const response = await axios.post('https://api.x.ai/v1/chat/completions', {
      model: 'grok-2-latest',
      messages: [{
        role: 'user',
        content: `Soy Grok de xAI. El usuario ha escrito esto: "${input}". Basándote únicamente en ese texto, identifica lo que pide para una playlist (como género musical, idioma, tema específico, estado de ánimo, o cualquier otro detalle mencionado). Crea una lista de ${songCount} canciones que cumpla exactamente con esos criterios, sin agregar nada que no se haya especificado. Si no se menciona algo (como idioma o género), usa tu criterio para elegir opciones populares. Excluye estas canciones que ya se intentaron: ${exclude.join(', ')}. Además, genera un nombre gracioso para la playlist de máximo dos palabras. Devuelve todo en este formato exacto y sin texto adicional:
Nombre de la Playlist: [Nombre gracioso de dos palabras]
1. Canción - Artista
2. Canción - Artista
... (hasta ${songCount}). Asegúrate de que las canciones sean conocidas, existan en Spotify, y sean relevantes a lo que el usuario pidió, y que el nombre sea creativo y divertido.`
      }],
      max_tokens: 500,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const rawResponse = response.data.choices[0].message.content;
    console.log('Respuesta cruda de Grok (sin procesar):\n', rawResponse);
    return rawResponse;
  } catch (error) {
    throw new Error('Error con Grok: ' + error.message);
  }
}

async function searchTracks(suggestions, existingTracks = []) {
  const tracks = [...existingTracks];
  const seenTracks = new Set(tracks);
  const lines = suggestions.split('\n').filter(line => line.trim() !== '');
  const playlistNameLine = lines[0].startsWith('Nombre de la Playlist:') ? lines.shift() : null;
  const playlistName = playlistNameLine ? playlistNameLine.replace('Nombre de la Playlist:', '').trim() : 'Playlist Random';

  console.log('Nombre de la Playlist generado por Grok:', playlistName);
  console.log('Líneas procesadas de Grok:', lines);
  console.log('Buscando canciones en Spotify:');
  for (const line of lines) {
    const song = line.replace(/^\d+\.\s*/, '').trim();
    if (!song) continue;
    try {
      const [title, artist] = song.split(' - ').map(s => s.trim());
      let result;

      const exactQuery = `track:${title} artist:${artist}`;
      result = await spotify.spotifyApi.searchTracks(exactQuery, { limit: 1 });
      if (result.body.tracks.items.length > 0) {
        const trackUri = result.body.tracks.items[0].uri;
        const trackName = result.body.tracks.items[0].name;
        const trackArtist = result.body.tracks.items[0].artists[0].name;
        if (!seenTracks.has(trackUri)) {
          console.log(`Encontrado (exacto): "${trackName}" - ${trackArtist} (${trackUri})`);
          tracks.push(trackUri);
          seenTracks.add(trackUri);
        }
        continue;
      }

      const titleQuery = `track:${title}`;
      result = await spotify.spotifyApi.searchTracks(titleQuery, { limit: 1 });
      if (result.body.tracks.items.length > 0) {
        const trackUri = result.body.tracks.items[0].uri;
        const trackName = result.body.tracks.items[0].name;
        const trackArtist = result.body.tracks.items[0].artists[0].name;
        if (!seenTracks.has(trackUri)) {
          console.log(`Encontrado (variante por título): "${trackName}" - ${trackArtist} (${trackUri})`);
          tracks.push(trackUri);
          seenTracks.add(trackUri);
        }
      } else {
        console.log(`No se encontró variante para: "${song}"`);
      }
    } catch (error) {
      console.log(`Error buscando "${song}": ${error.message}`, error.response ? error.response.data : '');
    }
  }
  return { tracks, playlistName };
}

async function ensureExactTracks(input, songCount, initialSuggestions) {
  let { tracks, playlistName } = await searchTracks(initialSuggestions);
  let attemptedSongs = initialSuggestions.split('\n').filter(line => line.trim() !== '' && !line.startsWith('Nombre de la Playlist:')).map(line => line.replace(/^\d+\.\s*/, '').trim());

  while (tracks.length < songCount) {
    console.log(`Solo se encontraron ${tracks.length} canciones de ${songCount}. Solicitando más sugerencias...`);
    const remaining = songCount - tracks.length;
    const newSuggestions = await getSuggestions(input, remaining, attemptedSongs);
    const { tracks: newTracks, playlistName: newPlaylistName } = await searchTracks(newSuggestions, tracks);
    tracks = newTracks;
    playlistName = playlistName || newPlaylistName;
    attemptedSongs = attemptedSongs.concat(newSuggestions.split('\n').filter(line => line.trim() !== '' && !line.startsWith('Nombre de la Playlist:')).map(line => line.replace(/^\d+\.\s*/, '').trim()));
  }

  return { tracks: tracks.slice(0, songCount), playlistName };
}

router.post('/create-playlist', async (req, res) => {
  const request = req.body.request;
  const songCount = req.body.songCount || 5; // Por defecto 5
  const orderId = req.body.orderId;

  // Verificar si se necesita pago según la cantidad de canciones
  if (songCount > 5) {
    const isPaidResponse = await fetch('http://localhost:3000/api/is-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    const { isPaid } = await isPaidResponse.json();

    if (!isPaid) {
      return res.status(403).json({ error: 'You need to donate $2 to create a 10-song playlist!' });
    }
  }

  try {
    const initialSuggestions = await getSuggestions(request, songCount);
    const { tracks, playlistName } = await ensureExactTracks(request, songCount, initialSuggestions);
    const playlistUrl = await spotify.createPlaylist(tracks, playlistName);

    // Si el usuario pagó, marcar el pago como usado
    if (songCount > 5 && orderId) {
      await fetch('http://localhost:3000/api/use-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      console.log(`Payment ${orderId} used for ${songCount}-song playlist`);
    }

    res.json({ playlistUrl, playlistName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/test', (req, res) => {
  res.send('Working from grok.js!');
});

module.exports = router;