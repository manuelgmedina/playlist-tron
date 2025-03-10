const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const dotenv = require('dotenv');
const grok = require('./grok');

dotenv.config();

const app = express();
app.use(express.json());

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

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

app.get('/api/spotify-auth-status', (req, res) => {
  const isAuthenticated = !!spotifyApi.getAccessToken();
  res.json({ isAuthenticated });
});

app.post('/api/create-playlist', async (req, res) => {
  const { request, songCount, orderId } = req.body;
  if (songCount > 5 && !orderId) {
    return res.status(402).json({ error: 'Payment required for more than 5 songs' });
  }
  try {
    const playlist = await grok.createPlaylist(request, songCount, spotifyApi);
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/donation-success', (req, res) => {
  res.sendStatus(200);
});

app.post('/api/support-success', (req, res) => {
  res.sendStatus(200);
});

module.exports = app;