const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const router = express.Router();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/spotify/callback'
});

router.get('/login', (req, res) => {
  const scopes = ['playlist-modify-public', 'playlist-modify-private'];
  console.log('Redirecting to Spotify login');
  res.redirect(spotifyApi.createAuthorizeURL(scopes));
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    spotifyApi.setAccessToken(data.body['access_token']);
    console.log('Spotify token set:', data.body['access_token']);
    res.redirect('/');
  } catch (error) {
    console.error('Error connecting Spotify:', error.message);
    res.status(500).send('Error connecting Spotify: ' + error.message);
  }
});

async function createPlaylist(tracks, name = 'Custom Playlist') {
  try {
    const playlist = await spotifyApi.createPlaylist(name, { public: true });
    await spotifyApi.addTracksToPlaylist(playlist.body.id, tracks);
    return playlist.body.external_urls.spotify;
  } catch (error) {
    console.error('Error creating playlist:', error);
    throw error;
  }
}

module.exports = router;
module.exports.createPlaylist = createPlaylist;
module.exports.spotifyApi = spotifyApi;