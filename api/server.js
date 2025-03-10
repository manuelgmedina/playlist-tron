require('dotenv').config();
const express = require('express');
const spotifyRoutes = require('./spotify');
const grokRoutes = require('./grok');

const app = express();
const paidOrders = new Set();

app.use(express.json());
app.use(express.static('public'));

app.use('/spotify', spotifyRoutes);
app.use('/api', grokRoutes);

app.post('/api/paypal-webhook', (req, res) => {
  const event = req.body;
  console.log('Webhook received:', event);

  if (event.event_type === 'PAYMENT.SALE.COMPLETED' && event.resource.state === 'completed') {
    const orderId = event.resource.parent_payment;
    const description = event.resource.description || '';
    if (description.includes('Unlock')) {
      paidOrders.add(orderId);
      console.log(`Payment registered with orderId ${orderId} for unlocking`);
    } else {
      console.log(`Payment registered with orderId ${orderId} as support (no unlock)`);
    }
  }

  res.status(200).send('Webhook received');
});

app.post('/api/donation-success', (req, res) => {
  const { orderId } = req.body;
  paidOrders.add(orderId);
  console.log(`Donation registered with orderId ${orderId} for unlocking`);
  res.json({ success: true });
});

app.post('/api/support-success', (req, res) => {
  const { orderId } = req.body;
  console.log(`Support donation registered with orderId ${orderId} (no unlock)`);
  res.json({ success: true });
});

app.post('/api/is-paid', (req, res) => {
  const { orderId } = req.body;
  const isPaid = paidOrders.has(orderId);
  res.json({ isPaid, orderId: isPaid ? orderId : null });
});

app.post('/api/use-payment', (req, res) => {
  const { orderId } = req.body;
  if (paidOrders.has(orderId)) {
    paidOrders.delete(orderId);
    console.log(`Payment ${orderId} used and removed`);
  }
  res.json({ success: true });
});

app.get('/api/spotify-auth-status', (req, res) => {
  try {
    const isAuthenticated = spotifyRoutes.spotifyApi.getAccessToken() !== undefined;
    console.log('Authentication status:', isAuthenticated);
    res.json({ isAuthenticated });
  } catch (error) {
    console.error('Error in /api/spotify-auth-status:', error);
    res.status(500).json({ error: 'Internal server error checking Spotify auth' });
  }
});

module.exports = app;