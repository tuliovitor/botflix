/**
 * BotFlix — scripts.js
 * Handles: chip selection, form submission, n8n webhook integration,
 *          loading states, result rendering, and animations.
 */

// ============================================================
// CONFIGURATION — Set your n8n webhook URL here
// ============================================================
const N8N_WEBHOOK_URL = "https://tuliovitor925.app.n8n.cloud/webhook/buscar-filme";

// ============================================================
// DOM References
// ============================================================
const userPrompt      = document.getElementById('user-prompt');
const chipsContainer  = document.getElementById('chips-container');
const ctaButton       = document.getElementById('cta-button');
const loadingContainer= document.getElementById('loading-container');
const errorContainer  = document.getElementById('error-container');
const retryButton     = document.getElementById('retry-button');
const resultSection   = document.getElementById('result-section');

// Result elements
const resultPoster   = document.getElementById('result-poster');
const resultTitle    = document.getElementById('result-title');
const resultYear     = document.getElementById('result-year');
const resultGenre    = document.getElementById('result-genre');
const resultSynopsis = document.getElementById('result-synopsis');
const resultWhyWatch = document.getElementById('result-why-watch');

// Streaming elements
const streamingSection = document.getElementById('streaming-section');
const streamingLogos   = document.getElementById('streaming-logos');

// ============================================================
// Chip Click → Fill Textarea
// ============================================================
chipsContainer.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;

  const promptText = chip.getAttribute('data-prompt');
  userPrompt.value = promptText;
  userPrompt.focus();

  // Visual feedback — brief pulse
  chip.style.transform = 'scale(0.93)';
  setTimeout(() => {
    chip.style.transform = '';
  }, 150);
});

// ============================================================
// CTA Button Click → Start Flow
// ============================================================
ctaButton.addEventListener('click', () => {
  const text = userPrompt.value.trim();
  if (!text) {
    // Shake the textarea if empty
    userPrompt.style.animation = 'none';
    void userPrompt.offsetWidth; // force reflow
    userPrompt.style.animation = 'shakeInput 0.5s ease';
    userPrompt.focus();
    return;
  }

  sendToN8N(text);
});

// Allow Ctrl+Enter to submit
userPrompt.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    ctaButton.click();
  }
});

// Retry button
retryButton.addEventListener('click', () => {
  const text = userPrompt.value.trim();
  if (text) sendToN8N(text);
});

// ============================================================
// UI State Helpers
// ============================================================
function showLoading() {
  resultSection.classList.remove('active');
  errorContainer.classList.remove('active');
  loadingContainer.classList.add('active');
  ctaButton.disabled = true;
}

function hideLoading() {
  loadingContainer.classList.remove('active');
  ctaButton.disabled = false;
}

function showError() {
  hideLoading();
  errorContainer.classList.add('active');
}

function showResult(data) {
  hideLoading();
  errorContainer.classList.remove('active');

  // Populate result card
  resultTitle.textContent    = data.title    || 'Sem título';
  resultYear.textContent     = data.year     || '—';
  resultGenre.textContent    = data.genre    || 'Gênero';
  resultSynopsis.textContent = data.synopsis || '';
  resultWhyWatch.textContent = data.why_watch|| '';

  // Poster with fallback
  if (data.poster_url) {
    resultPoster.src = data.poster_url;
    resultPoster.alt = `Poster de ${data.title}`;
    resultPoster.onerror = () => {
      resultPoster.src = generatePlaceholderPoster(data.title);
    };
  } else {
    resultPoster.src = generatePlaceholderPoster(data.title);
  }

  // ✅ Streaming — Onde Assistir
  if (data.streaming && data.streaming.length > 0) {
    streamingLogos.innerHTML = data.streaming.map(p => `
      <a href="${p.link}" target="_blank" rel="noopener noreferrer" title="${p.name}">
        <img src="${p.logo}" alt="${p.name}" title="${p.name}" loading="lazy" />
      </a>
    `).join('');
    streamingSection.classList.add('active');
  } else {
    streamingSection.classList.remove('active');
    streamingLogos.innerHTML = '';
  }

  // Trigger CSS animation by re-adding the class
  resultSection.classList.remove('active');
  void resultSection.offsetWidth; // reflow
  resultSection.classList.add('active');

  // Smooth scroll to result
  setTimeout(() => {
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// ============================================================
// Generate a placeholder poster (SVG data URI)
// ============================================================
function generatePlaceholderPoster(title) {
  const displayTitle = (title || 'Filme').substring(0, 20);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1c1b1b"/>
          <stop offset="100%" stop-color="#2a2a2a"/>
        </linearGradient>
      </defs>
      <rect width="400" height="600" fill="url(#bg)"/>
      <text x="200" y="280" text-anchor="middle" fill="#5e3f3b" font-family="sans-serif" font-size="48">🎬</text>
      <text x="200" y="330" text-anchor="middle" fill="#c8c6c5" font-family="sans-serif" font-size="16">${escapeXml(displayTitle)}</text>
    </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
}

// ============================================================
// sendToN8N — Main API call
// ============================================================
async function sendToN8N(texto) {
  if (!N8N_WEBHOOK_URL) {
    console.warn('⚠️ N8N_WEBHOOK_URL não configurada. Usando dados de demonstração.');
    showLoading();
    setTimeout(() => {
      showResult(getDemoData(texto));
    }, 2200);
    return;
  }

  showLoading();

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: texto }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.title) {
      throw new Error('Resposta inválida: campo "title" ausente.');
    }

    showResult(data);
  } catch (err) {
    console.error('❌ Erro ao chamar n8n:', err);
    showError();
  }
}

// ============================================================
// Demo Data (usado quando N8N_WEBHOOK_URL está vazia)
// ============================================================
function getDemoData(userText) {
  const demos = [
    {
      title: 'Interestelar',
      year: '2014',
      genre: 'Ficção Científica',
      poster_url: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
      synopsis: 'Em um futuro onde a Terra está se tornando inabitável, um grupo de astronautas viaja através de um buraco de minhoca em busca de um novo lar para a humanidade.',
      why_watch: 'Com direção magistral de Christopher Nolan e uma trilha sonora inesquecível de Hans Zimmer, Interestelar é uma experiência cinematográfica que combina ciência real com emoção profunda.',
      streaming: []
    },
    {
      title: 'Parasita',
      year: '2019',
      genre: 'Thriller / Drama',
      poster_url: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
      synopsis: 'Uma família pobre consegue empregos na mansão de uma família rica, desencadeando uma série de eventos imprevisíveis.',
      why_watch: 'Vencedor de 4 Oscars incluindo Melhor Filme — o primeiro em língua não inglesa a conquistar o prêmio máximo.',
      streaming: []
    },
  ];

  const lower = userText.toLowerCase();
  if (lower.includes('terror') || lower.includes('medo') || lower.includes('horror')) {
    return {
      title: 'Hereditário',
      year: '2018',
      genre: 'Terror Psicológico',
      poster_url: 'https://image.tmdb.org/t/p/w500/p9fmuz2Oj3HtEJOv0R8MEHiNFln.jpg',
      synopsis: 'Após a morte misteriosa da matriarca, a família Graham começa a desvendar segredos sombrios sobre sua linhagem.',
      why_watch: 'Ari Aster reinventou o terror com este filme que é mais um drama familiar devastador do que um filme de sustos fáceis.',
      streaming: []
    };
  }

  return demos[Math.floor(Math.random() * demos.length)];
}

// ============================================================
// Shake animation (injected via JS for empty prompt)
// ============================================================
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shakeInput {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
  20%, 40%, 60%, 80% { transform: translateX(6px); }
}
`;
document.head.appendChild(shakeStyle);