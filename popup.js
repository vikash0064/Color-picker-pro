const pickBtn = document.getElementById('pick-btn');
const output = document.getElementById('result');
const colorCode = output.querySelector('.color-code');
const colorPreview = output.querySelector('.color-preview');
const recentColorsKey = 'recent-colors';
const paletteNameElement = document.getElementById('palette-name');

// --- Pick Color with Eyedropper ---
pickBtn.addEventListener('click', async () => {
  if (!('EyeDropper' in window)) {
    colorCode.textContent = 'Eyedropper API not supported';
    return;
  }

  document.body.style.cursor = 'crosshair';
  showMagnifier();

  const dropper = new EyeDropper();
  const abortController = new AbortController();

  try {
    const result = await dropper.open({ signal: abortController.signal });

    colorCode.textContent = result.sRGBHex;
    colorPreview.style.backgroundColor = result.sRGBHex;
    await navigator.clipboard.writeText(result.sRGBHex);

    saveToRecentColors(result.sRGBHex);
    await displayRecentColors();
  } catch (err) {
    if (err.name !== 'AbortError') {
      colorCode.textContent = 'Cancelled or Error';
      colorPreview.style.backgroundColor = 'transparent';
    }
  } finally {
    hideMagnifier();
    document.body.style.cursor = 'default';
  }
});

// --- Magnifier Functions ---
let magnifier = null;

function showMagnifier() {
  magnifier = document.createElement('div');
  magnifier.style.position = 'fixed';
  magnifier.style.width = '100px';
  magnifier.style.height = '100px';
  magnifier.style.border = '2px solid #fff';
  magnifier.style.borderRadius = '50%';
  magnifier.style.overflow = 'hidden';
  magnifier.style.boxShadow = '0 0 6px rgba(0,0,0,0.5)';
  magnifier.style.zIndex = '9999';
  magnifier.style.pointerEvents = 'none';

  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  magnifier.appendChild(canvas);
  document.body.appendChild(magnifier);

  document.addEventListener('mousemove', moveMagnifier);
}

function hideMagnifier() {
  if (magnifier) {
    document.removeEventListener('mousemove', moveMagnifier);
    magnifier.remove();
    magnifier = null;
  }
}

function moveMagnifier(e) {
  const canvas = magnifier.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const zoom = 5;
  const size = 20;

  magnifier.style.left = `${e.clientX + 20}px`;
  magnifier.style.top = `${e.clientY - 60}px`;

  try {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        ctx.clearRect(0, 0, 100, 100);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          img,
          e.screenX - size / 2,
          e.screenY - size / 2,
          size,
          size,
          0,
          0,
          100,
          100
        );
      };
    });
  } catch (e) {
    console.warn("Capture error:", e);
  }
}

// --- Color History Functions ---
function saveToRecentColors(hex) {
  return new Promise((resolve) => {
    chrome.storage.sync.get([recentColorsKey], (res) => {
      let colors = res[recentColorsKey] || [];
      if (!colors.includes(hex)) {
        colors = [hex, ...colors.filter(c => c !== hex)];
        if (colors.length > 5) colors = colors.slice(0, 5);
        chrome.storage.sync.set({ [recentColorsKey]: colors }, () => resolve());
      } else {
        resolve();
      }
    });
  });
}

async function displayRecentColors() {
  const colors = await new Promise(resolve => {
    chrome.storage.sync.get([recentColorsKey], (res) => {
      resolve(res[recentColorsKey] || []);
    });
  });

  const historyBox = document.getElementById('history-box') || createHistoryBox();
  historyBox.innerHTML = '';

  colors.forEach((color) => {
    const colorElement = createColorElement(color);
    historyBox.appendChild(colorElement);
  });
}

function createHistoryBox() {
  const historyBox = document.createElement('div');
  historyBox.id = 'history-box';
  historyBox.className = 'recent-colors';
  
  const container = document.querySelector('.container');
  if (container) {
    const paletteNameBox = document.getElementById('palette-name-box');
    if (paletteNameBox) {
      paletteNameBox.before(historyBox);
    } else {
      container.appendChild(historyBox);
    }
  }
  
  return historyBox;
}

function createColorElement(color) {
  const span = document.createElement('span');
  span.textContent = color;
  span.style.backgroundColor = color;
  span.style.color = getContrastColor(color);
  span.style.border = '1px solid #ccc';
  span.style.margin = '2px';
  span.style.padding = '2px 5px';
  span.style.fontSize = '10px';
  span.style.cursor = 'pointer';
  span.style.display = 'inline-block';
  span.style.borderRadius = '4px';

  span.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(color);
      colorCode.textContent = `${color} (Copied!)`;
      colorPreview.style.backgroundColor = color;
    } catch (err) {
      console.error('Copy failed:', err);
    }
  });

  return span;
}

function getContrastColor(hexColor) {
  if (!hexColor || hexColor.length < 7) return '#000';

  const r = parseInt(hexColor.substr(1, 2), 16);
  const g = parseInt(hexColor.substr(3, 2), 16);
  const b = parseInt(hexColor.substr(5, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// --- Clear History ---
document.getElementById('clear-history').addEventListener('click', () => {
  chrome.storage.sync.remove(recentColorsKey, () => {
    displayRecentColors();
    paletteNameElement.textContent = 'Recent Colors';
  });
});
