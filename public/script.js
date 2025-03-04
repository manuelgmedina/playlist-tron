const songCountInput = document.getElementById('songCount');
const songCountDisplay = document.getElementById('songCountDisplay');
const paypalButtonsContainer = document.getElementById('paypal-buttons');
const supportPaypalButtonsContainer = document.getElementById('support-paypal-buttons');
const supportAmountInput = document.getElementById('supportAmount');
const authMessage = document.getElementById('authMessage');
let paypalButtonsRendered = false;
let supportButtonsRendered = false;
let latestOrderId = null;

songCountInput.addEventListener('input', () => {
  songCountDisplay.textContent = songCountInput.value;
  updateSliderColor(songCountInput.value);
});

function updateSliderColor(value) {
  const slider = document.getElementById('songCount');
  if (value <= 5) {
    slider.style.background = 'linear-gradient(to right, #d1d5db, #60a5fa)';
  } else {
    slider.style.background = 'linear-gradient(to right, #d1d5db, #f472b6)';
  }
}

async function checkSpotifyAuth() {
  try {
    const response = await fetch('/api/spotify-auth-status');
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    authMessage.style.display = data.isAuthenticated ? 'none' : 'block';
    return data.isAuthenticated;
  } catch (error) {
    console.error('Error checking auth:', error);
    authMessage.style.display = 'block';
    return false;
  }
}

window.onload = checkSpotifyAuth;

async function createPlaylist() {
  const isAuthenticated = await checkSpotifyAuth();
  if (!isAuthenticated) return;

  const request = document.getElementById('request').value;
  const songCount = parseInt(songCountInput.value);
  const resultDiv = document.getElementById('result');
  const spinner = document.getElementById('spinner');

  spinner.style.display = 'block';
  resultDiv.innerHTML = '';

  try {
    const response = await fetch('/api/create-playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request, songCount, orderId: latestOrderId })
    });
    const data = await response.json();

    if (response.ok && data.playlistUrl) {
      resultDiv.innerHTML = `<p>Your playlist "${data.playlistName}" is ready!</p><a href="${data.playlistUrl}" target="_blank">Listen here!</a>`;
      latestOrderId = null;
    } else {
      resultDiv.innerHTML = `<p>${data.error}</p><p>Need more than 5 songs? <a href="#" onclick="donate()">Donate $2 here</a> to unlock.</p>`;
    }
  } catch (error) {
    resultDiv.textContent = 'Error: ' + error.message;
  } finally {
    spinner.style.display = 'none';
  }
}

function donate() {
  const isAuthenticated = checkSpotifyAuth();
  if (!isAuthenticated) return;

  const songCount = parseInt(songCountInput.value);
  if (songCount <= 5) {
    alert('No need to donate for 5 songs or fewer!');
    return;
  }

  if (!paypalButtonsRendered) {
    paypal.Buttons({
      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [{
            amount: { value: '2.00', currency_code: 'USD' },
            description: 'Unlock a 10-Song Playlist'
          }]
        });
      },
      onApprove: (data, actions) => {
        return actions.order.capture().then((details) => {
          latestOrderId = data.orderID;
          fetch('/api/donation-success', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: data.orderID })
          }).then(() => {
            alert('Thanks for your $2 donation! Creating your playlist...');
            paypalButtonsContainer.style.display = 'none';
            createPlaylist();
          });
        });
      },
      onError: (err) => {
        document.getElementById('result').textContent = 'Payment error: ' + err.message;
      }
    }).render('#paypal-buttons');
    paypalButtonsRendered = true;
  }

  paypalButtonsContainer.style.display = 'block';
}

function support() {
  const isAuthenticated = checkSpotifyAuth();
  if (!isAuthenticated) return;

  const amount = parseFloat(supportAmountInput.value) || 1.00;
  if (amount < 0.01) {
    alert('Please enter a valid amount (minimum $0.01).');
    return;
  }

  if (!supportButtonsRendered) {
    paypal.Buttons({
      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [{
            amount: { value: amount.toFixed(2), currency_code: 'USD' },
            description: 'Support the Playlist-o-Tron Project'
          }]
        });
      },
      onApprove: (data, actions) => {
        return actions.order.capture().then((details) => {
          fetch('/api/support-success', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: data.orderID })
          }).then(() => {
            alert('Thanks for supporting with $' + details.purchase_units[0].amount.value + '!');
            supportPaypalButtonsContainer.style.display = 'none';
          });
        });
      },
      onError: (err) => {
        document.getElementById('result').textContent = 'Support error: ' + err.message;
      }
    }).render('#support-paypal-buttons');
    supportButtonsRendered = true;
  }

  supportPaypalButtonsContainer.style.display = 'block';
}