const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const dotenv = require('dotenv');
const grok = require('./grok');

dotenv.config();

const app = express();
app.use(express.json());

// Inicializar Spotify API
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// Autenticación con Spotify
app.get('/spotify/login', (req, res) => {
  const scopes = ['playlist-modify-public', 'playlist-modify-private'];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes, 'state');
  res.redirect(authorizeURL);
});

app.get('/spotify/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    spotifyApi.setAccessToken(data.body['access_token']);
    spotifyApi.setRefreshToken(data.body['refresh_token']);
    res.redirect('/');
  } catch (error) {
    res.send('Error during authentication: ' + error.message);
  }
});

// Estado de autenticación
app.get('/api/spotify-auth-status', (req, res) => {
  const isAuthenticated = !!spotifyApi.getAccessToken();
  res.json({ isAuthenticated });
});

// Crear playlist (usando tu grok.js)
app.post('/api/create-playlist', async (req, res) => {
  const { request, songCount, orderId } = req.body;

  if (!spotifyApi.getAccessToken()) {
    return res.status(401).json({ error: 'Not authenticated with Spotify' });
  }

  if (songCount > 5 && !orderId) {
    return res.status(402).json({ error: 'Payment required for more than 5 songs' });
  }

  try {
    const { tracks, playlistName } = await grok.createPlaylist(request, songCount, spotifyApi);
    const userData = await spotifyApi.getMe();
    const userId = userData.body.id;

    const playlist = await spotifyApi.createPlaylist(userId, {
      name: playlistName,
      public: true
    });

    await spotifyApi.addTracksToPlaylist(playlist.body.id, tracks);

    res.json({
      playlistName: playlist.body.name,
      playlistUrl: playlist.body.external_urls.spotify
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirmación de donaciones
app.post('/api/donation-success', (req, res) => {
  res.sendStatus(200);
});

app.post('/api/support-success', (req, res) => {
  res.sendStatus(200);
});

module.exports = app;