const songCountInput = document.getElementById('songCount');
const songCountDisplay = document.getElementById('songCountDisplay');
const paypalButtonsContainer = document.getElementById('paypal-buttons');
const supportPaypalButtonsContainer = document.getElementById('support-paypal-buttons');
const supportAmountInput = document.getElementById('supportAmount');
const authMessage = document.getElementById('authMessage');
let paypalButtonsRendered = false;
let supportButtonsRendered = false;
let latestOrderId = null;
let currentLanguage = 'en';

// Traducciones
const translations = {
  en: {
    title: 'TuneCraft',
    spotifyLogin: 'Connect Spotify',
    placeholder: "Welcome to TuneCraft!\n- What it does: Uses AI to craft unique Spotify playlists.\n- Be as creative as you want.\n- How to use it:\n  1. Connect Spotify.\n  2. Type your wildest vibe.\n  3. Choose 5 songs (free) or donate €2 for 10.\n  4. Click 'Create Playlist' to enjoy!",
    sliderLabel: 'How many songs?',
    createButton: 'Create Playlist',
    donateButton: 'Donate for More Songs',
    supportButton: 'Support the Project',
    authMessage: 'Connect with <a href="/spotify/login">Spotify</a> first to use this feature!',
    paymentErrorLastName: 'Payment failed: Please enter a valid last name (e.g., no special characters or accents).',
    paymentErrorGeneric: 'Payment error: Something went wrong. Try again.',
    donationSuccess: 'Thanks for your €2 donation! Creating your playlist...',
    supportSuccess: 'Thanks for supporting with €'
  },
  es: {
    title: 'TuneCraft',
    spotifyLogin: 'Conectar Spotify',
    placeholder: "¡Bienvenido a TuneCraft!\n- Qué hace: Usa IA para crear listas únicas en Spotify.\n- Sé tan creativo como quieras.\n- Cómo usarlo:\n  1. Conecta Spotify.\n  2. Escribe tu vibe más loco.\n  3. Elige 5 canciones (gratis) o dona 2€ por 10.\n  4. Haz clic en 'Crear Lista' y disfruta!",
    sliderLabel: '¿Cuántas canciones?',
    createButton: 'Crear Lista',
    donateButton: 'Donar por Más Canciones',
    supportButton: 'Apoyar el Proyecto',
    authMessage: '¡Conecta con <a href="/spotify/login">Spotify</a> primero para usar esta función!',
    paymentErrorLastName: 'Pago fallido: Por favor, introduce un apellido válido (p.ej., sin caracteres especiales ni acentos).',
    paymentErrorGeneric: 'Error de pago: Algo salió mal. Intenta de nuevo.',
    donationSuccess: '¡Gracias por tu donación de 2€! Creando tu lista...',
    supportSuccess: '¡Gracias por apoyar con €'
  }
};

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
    authMessage.innerHTML = translations[currentLanguage].authMessage;
    authMessage.style.display = data.isAuthenticated ? 'none' : 'block';
    return data.isAuthenticated;
  } catch (error) {
    console.error('Error checking auth:', error);
    authMessage.innerHTML = translations[currentLanguage].authMessage;
    authMessage.style.display = 'block';
    return false;
  }
}

function setLanguage(lang) {
  currentLanguage = lang;
  document.getElementById('title').textContent = translations[lang].title;
  document.getElementById('spotifyLogin').textContent = translations[lang].spotifyLogin;
  document.getElementById('request').placeholder = translations[lang].placeholder;
  document.getElementById('sliderLabel').textContent = translations[lang].sliderLabel;
  document.getElementById('createButton').textContent = translations[lang].createButton;
  document.getElementById('donateButton').textContent = translations[lang].donateButton;
  document.getElementById('supportButton').textContent = translations[lang].supportButton;
  authMessage.innerHTML = translations[lang].authMessage;
}

window.onload = () => {
  setLanguage('en'); // Idioma predeterminado
  checkSpotifyAuth();
};

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
      resultDiv.innerHTML = `<p>${data.error}</p><p>Need more than 5 songs? <a href="#" onclick="donate()">Donate €2 here</a> to unlock.</p>`;
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

  paypalButtonsContainer.innerHTML = '';
  paypalButtonsContainer.style.display = 'block';

  if (!paypalButtonsRendered) {
    paypal.Buttons({
      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [{
            amount: { value: '2.00', currency_code: 'EUR' },
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
            alert(translations[currentLanguage].donationSuccess);
            paypalButtonsContainer.style.display = 'none';
            createPlaylist();
          });
        });
      },
      onError: (err) => {
        console.error('PayPal error:', err);
        const resultDiv = document.getElementById('result');
        if (err.message.includes('INVALID_LAST_NAME')) {
          resultDiv.textContent = translations[currentLanguage].paymentErrorLastName;
        } else {
          resultDiv.textContent = translations[currentLanguage].paymentErrorGeneric;
        }
      }
    }).render('#paypal-buttons');
    paypalButtonsRendered = true;
  }
}

function support() {
  const isAuthenticated = checkSpotifyAuth();
  if (!isAuthenticated) return;

  const amount = parseFloat(supportAmountInput.value) || 1.00;
  if (amount < 0.01) {
    alert('Please enter a valid amount (minimum €0.01).');
    return;
  }

  supportPaypalButtonsContainer.innerHTML = '';
  supportPaypalButtonsContainer.style.display = 'block';

  if (!supportButtonsRendered) {
    paypal.Buttons({
      createOrder: (data, actions) => {
        return actions.order.create({
          purchase_units: [{
            amount: { value: amount.toFixed(2), currency_code: 'EUR' },
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
            alert(translations[currentLanguage].supportSuccess + details.purchase_units[0].amount.value + '!');
            supportPaypalButtonsContainer.style.display = 'none';
          });
        });
      },
      onError: (err) => {
        console.error('PayPal error (support):', err);
        document.getElementById('result').textContent = translations[currentLanguage].paymentErrorGeneric;
      }
    }).render('#support-paypal-buttons');
    supportButtonsRendered = true;
  }
}