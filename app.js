/**
 * ThoughtSort - AI Voice Notes & Smart To-Do App
 * Based on PRD Draft v1 (16 November 2026)
 */

// ==================== STATE MANAGEMENT ====================
const APP_STORAGE_KEY = 'thoughtsort_items_v1';
const NOTES_STORAGE_KEY = 'thoughtsort_notes_v1';
const SETTINGS_STORAGE_KEY = 'thoughtsort_settings_v1';

let appState = {
  items: [],
  notes: [],
  currentCategory: 'all',
  currentTimeline: 'all-time',
  currentPriority: 'all',
  currentTag: null,
  searchQuery: '',
  sortBy: 'newest',
  isRecording: false,
  recognition: null,
  mediaRecorder: null,
  audioChunks: [],
  lastRecordedAudioUrl: null,
  recordingStartTime: null,
  recordingTimerInterval: null,
  audioContext: null,
  analyser: null,
  animFrameId: null,
  stagedReviewItems: [],
  currentReviewNoteId: null,
  activeReminderItem: null
};

// ==================== DEFAULT SEED DATA (PRD Page 1 Example) ====================
const DEFAULT_PRD_ITEMS = [
  {
    id: 'item-prd-1',
    noteId: 'note-prd-1',
    title: 'Complete Java assignment',
    category: 'task',
    dueDate: getRelativeDateOffset(1), // Tomorrow
    dueTime: '17:00',
    priority: 'High',
    status: 'pending',
    tags: ['college', 'java', 'assignment'],
    confidence: 0.96,
    originalText: 'I have to complete my Java assignment by tomorrow.',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'item-prd-2',
    noteId: 'note-prd-1',
    title: 'Buy groceries',
    category: 'reminder',
    dueDate: getRelativeDateOffset(0), // Today
    dueTime: '18:00',
    priority: 'Medium',
    status: 'pending',
    tags: ['errands', 'shopping'],
    confidence: 0.98,
    originalText: 'I also need to buy groceries today at 6 PM.',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'item-prd-3',
    noteId: 'note-prd-1',
    title: 'Start machine learning course',
    category: 'goal',
    dueDate: getRelativeDateOffset(7), // Next week
    dueTime: null,
    priority: 'Low',
    status: 'pending',
    tags: ['learning', 'ai', 'courses'],
    confidence: 0.92,
    originalText: 'I have been thinking about starting a machine learning course next week.',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'item-prd-4',
    noteId: 'note-prd-1',
    title: 'New college project idea',
    category: 'idea',
    dueDate: null,
    dueTime: null,
    priority: 'None',
    status: 'pending',
    tags: ['college', 'project', 'ideation'],
    confidence: 0.94,
    originalText: 'Also, I have an idea for a new college project.',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];

const DEFAULT_PRD_NOTE = {
  id: 'note-prd-1',
  audioPath: null,
  transcript: 'I have to complete my Java assignment by tomorrow. I also need to buy groceries today at 6 PM. I have been thinking about starting a machine learning course next week. Also, I have an idea for a new college project.',
  itemIds: ['item-prd-1', 'item-prd-2', 'item-prd-3', 'item-prd-4'],
  createdAt: new Date(Date.now() - 3600000).toISOString()
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupSpeechRecognition();
  setupEventListeners();
  updateCategoryBadges();
  renderItems();
  startReminderChecker();
  lucide.createIcons();
});

function loadData() {
  try {
    const storedItems = localStorage.getItem(APP_STORAGE_KEY);
    const storedNotes = localStorage.getItem(NOTES_STORAGE_KEY);

    if (storedItems && JSON.parse(storedItems).length > 0) {
      appState.items = JSON.parse(storedItems);
      appState.notes = storedNotes ? JSON.parse(storedNotes) : [];
    } else {
      // Seed with initial PRD items
      appState.items = [...DEFAULT_PRD_ITEMS];
      appState.notes = [DEFAULT_PRD_NOTE];
      saveData();
    }
  } catch (err) {
    console.error('Error loading data from localStorage:', err);
    appState.items = [...DEFAULT_PRD_ITEMS];
    appState.notes = [DEFAULT_PRD_NOTE];
  }
}

function saveData() {
  try {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(appState.items));
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(appState.notes));
  } catch (err) {
    console.error('Failed to save to localStorage', err);
  }
}

// ==================== SPEECH-TO-TEXT & AUDIO CAPTURE (FR-1, FR-2, FR-5) ====================
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('recordingSubtext').textContent = 
      'Web Speech API not natively supported in this browser. You can type freely or use demo presets!';
    return;
  }

  appState.recognition = new SpeechRecognition();
  appState.recognition.continuous = true;
  appState.recognition.interimResults = true;
  appState.recognition.lang = 'en-US';

  appState.recognition.onstart = () => {
    appState.isRecording = true;
    updateRecordingUI(true);
  };

  appState.recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const textarea = document.getElementById('brainDumpTextarea');
    if (finalTranscript) {
      textarea.value = (textarea.value.trim() ? textarea.value.trim() + ' ' : '') + finalTranscript.trim();
    }
    updateCharCount();
  };

  appState.recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    showToast(`Microphone notice: ${event.error}`);
    stopRecording();
  };

  appState.recognition.onend = () => {
    if (appState.isRecording) {
      // If still set to recording, auto-restart or stop
      stopRecording();
    }
  };
}

async function toggleRecording() {
  if (appState.isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    // Request microphone access for audio recording & visualizer
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Set up audio visualization canvas
    setupAudioVisualizer(stream);

    // Set up MediaRecorder for FR-5 (Audio Playback)
    appState.audioChunks = [];
    appState.mediaRecorder = new MediaRecorder(stream);
    appState.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) appState.audioChunks.push(e.data);
    };
    appState.mediaRecorder.onstop = () => {
      const audioBlob = new Blob(appState.audioChunks, { type: 'audio/webm' });
      appState.lastRecordedAudioUrl = URL.createObjectURL(audioBlob);
      const audioEl = document.getElementById('audioPlayback');
      audioEl.src = appState.lastRecordedAudioUrl;
      document.getElementById('audioPlaybackContainer').classList.remove('hidden');
      document.getElementById('audioPlaybackContainer').classList.add('flex');
    };
    appState.mediaRecorder.start();

    // Start speech recognition
    if (appState.recognition) {
      try {
        appState.recognition.start();
      } catch (e) {
        console.log('Recognition start error:', e);
      }
    }

    appState.isRecording = true;
    appState.recordingStartTime = Date.now();
    updateRecordingUI(true);

    // Start Timer
    const timerEl = document.getElementById('recordingTimer');
    timerEl.classList.remove('hidden');
    appState.recordingTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - appState.recordingStartTime) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      timerEl.textContent = `${mins}:${secs}`;
    }, 1000);

  } catch (err) {
    console.error('Audio permission error:', err);
    showToast('Microphone access blocked or unavailable. Type your brain dump directly!');
  }
}

function stopRecording() {
  appState.isRecording = false;
  updateRecordingUI(false);

  if (appState.recognition) {
    try { appState.recognition.stop(); } catch (e) {}
  }

  if (appState.mediaRecorder && appState.mediaRecorder.state !== 'inactive') {
    appState.mediaRecorder.stop();
  }

  if (appState.recordingTimerInterval) {
    clearInterval(appState.recordingTimerInterval);
    appState.recordingTimerInterval = null;
  }

  if (appState.animFrameId) {
    cancelAnimationFrame(appState.animFrameId);
  }
}

function updateRecordingUI(isRecording) {
  const btn = document.getElementById('recordBtn');
  const status = document.getElementById('recordingStatus');
  const dot = document.getElementById('recordingDot');
  const micIcon = document.getElementById('micIcon');

  if (isRecording) {
    btn.classList.add('mic-active');
    btn.classList.remove('bg-indigo-600');
    status.textContent = 'Listening... Speak freely';
    status.classList.add('text-red-600');
    dot.classList.remove('hidden');
    micIcon.setAttribute('data-lucide', 'square');
  } else {
    btn.classList.remove('mic-active');
    btn.classList.add('bg-indigo-600');
    status.textContent = 'Tap to start voice recording';
    status.classList.remove('text-red-600');
    dot.classList.add('hidden');
    micIcon.setAttribute('data-lucide', 'mic');
  }
  lucide.createIcons();
}

function setupAudioVisualizer(stream) {
  const canvas = document.getElementById('audioCanvas');
  const canvasCtx = canvas.getContext('2d');
  
  if (!appState.audioContext) {
    appState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  const source = appState.audioContext.createMediaStreamSource(stream);
  appState.analyser = appState.audioContext.createAnalyser();
  appState.analyser.fftSize = 64;
  source.connect(appState.analyser);

  const bufferLength = appState.analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    appState.animFrameId = requestAnimationFrame(draw);
    appState.analyser.getByteFrequencyData(dataArray);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / bufferLength) * 1.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      canvasCtx.fillStyle = '#6366f1';
      canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
      x += barWidth;
    }
  }
  draw();
}

// ==================== AI NLP PROCESSING ENGINE (FR-6 to FR-12) ====================
/**
 * Splits unstructured text into distinct thoughts and extracts:
 * - Category (Task, Reminder, Idea, Goal, Note)
 * - Due date and time (normalized)
 * - Urgency / Priority (High, Medium, Low)
 * - Clean rewritten title
 * - Auto-tags (#college, #shopping, etc.)
 * - Classification confidence score
 */
function processBrainDump(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const sentences = splitIntoThoughts(rawText);
  const items = sentences.map((thought, idx) => {
    return analyzeSingleThought(thought, idx);
  });

  return items;
}

function splitIntoThoughts(text) {
  // Normalize whitespace
  let clean = text.replace(/\r\n/g, '\n').trim();
  
  // Split on transition keywords and sentence boundaries (avoid splitting "next week")
  const splitPattern = /(?:[\.\?!]\s+)|(?:\n+)|(?:\b(?:Also|In addition|Furthermore|Plus|Additionally|And then)\b[,:]?\s+)|(?:\bNext\b,\s+)|(?=(?:\bI also need to\b|\bI also have to\b|\bI have been thinking about\b|\bAlso I have an idea\b|\bDon't forget to\b|\bRemember to\b|\bI need to\b|\bI have to\b))/i;

  const rawPieces = clean.split(splitPattern);
  const result = [];

  rawPieces.forEach(piece => {
    let s = piece.trim();
    // Remove leading connectors like "Also, ", "And ", "Then "
    s = s.replace(/^(also|and|then|plus|furthermore|in addition)[,\s]+/i, '').trim();
    if (s.length > 5) {
      result.push(s);
    }
  });

  // Fallback if regex split produced only 1 chunk but multiple clear sentences exist
  if (result.length <= 1) {
    const simpleSentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
    if (simpleSentences && simpleSentences.length > 1) {
      return simpleSentences.map(s => s.trim()).filter(s => s.length > 5);
    }
  }

  return result.length > 0 ? result : [clean];
}

function analyzeSingleThought(thought, index) {
  const lower = thought.toLowerCase();

  // 1. EXTRACT DUE DATE & TIME (FR-8)
  const dateTimeInfo = extractDateTime(thought);

  // 2. CATEGORY CLASSIFICATION (FR-7)
  let category = 'task';
  let confidence = 0.90;

  const ideaPatterns = /\b(idea for|idea:|brainstorm|what if|maybe we could|concept|thought of creating|new project idea|innovate)\b/i;
  const goalPatterns = /\b(thinking about starting|start a|learning course|learn\b|study\b|goal|habit|exercise|workout|read\b|master\b|skill)\b/i;
  const reminderPatterns = /\b(buy\b|groceries|pick up|call\b|appointment|reminder|don't forget|remember to|today at|tomorrow at|\bpm\b|\bam\b|pay\b|errand)\b/i;
  const notePatterns = /\b(note:|fyi|remember that|summary|thought:|observation|info)\b/i;

  if (ideaPatterns.test(thought)) {
    category = 'idea';
    confidence = 0.95;
  } else if (goalPatterns.test(thought)) {
    category = 'goal';
    confidence = 0.92;
  } else if (reminderPatterns.test(thought) || dateTimeInfo.hasTime) {
    category = 'reminder';
    confidence = 0.96;
  } else if (notePatterns.test(thought)) {
    category = 'note';
    confidence = 0.88;
  } else {
    // Default to task
    category = 'task';
    confidence = 0.91;
  }

  // 3. PRIORITY DETECTION (FR-9)
  let priority = 'Low';
  const highPriorityWords = /\b(urgent|asap|tomorrow|immediately|crucial|exam|assignment|deadline|tonight|important|must)\b/i;
  const mediumPriorityWords = /\b(today|this week|soon|groceries|call|meeting|appointment|review)\b/i;

  if (highPriorityWords.test(thought)) {
    priority = 'High';
  } else if (mediumPriorityWords.test(thought) || category === 'reminder') {
    priority = 'Medium';
  } else if (category === 'idea' || category === 'note') {
    priority = 'None';
  }

  // 4. CLEAN REWRITTEN TITLE (FR-10)
  const cleanTitle = synthesizeTitle(thought, category);

  // 5. AUTO-TAG GENERATION (FR-11)
  const tags = extractTags(thought, cleanTitle, category);

  return {
    id: `item-${Date.now()}-${index}`,
    title: cleanTitle,
    category: category,
    dueDate: dateTimeInfo.date,
    dueTime: dateTimeInfo.time,
    dueFormatted: dateTimeInfo.formatted,
    priority: priority,
    tags: tags,
    confidence: confidence,
    originalText: thought,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
}

function synthesizeTitle(text, category) {
  let title = text;

  // Handle PRD Idea pattern specifically: "an idea for a new college project" -> "New college project idea"
  if (category === 'idea' && /idea for (a )?(.+)/i.test(title)) {
    const match = title.match(/idea for (a )?(.+)/i);
    if (match && match[2]) {
      let core = match[2].replace(/[.,:;!?]+$/, '').trim();
      return core.charAt(0).toUpperCase() + core.slice(1) + (core.toLowerCase().endsWith('idea') ? '' : ' idea');
    }
  }

  // Strip conversational filler openers
  const fillers = [
    /^i have to\s+/i,
    /^i also have to\s+/i,
    /^i also need to\s+/i,
    /^i need to\s+/i,
    /^need to\s+/i,
    /^i have been thinking about\s+/i,
    /^i've been thinking about\s+/i,
    /^also,?\s+i have an idea for\s+/i,
    /^i have an idea for\s+/i,
    /^an idea for\s+/i,
    /^don't forget to\s+/i,
    /^remember to\s+/i,
    /^please\s+/i,
    /^we should\s+/i,
    /^maybe i should\s+/i
  ];

  fillers.forEach(filler => {
    title = title.replace(filler, '');
  });

  // Convert gerunds if needed: "starting a machine learning course" -> "Start a machine learning course"
  title = title.replace(/^starting\s+/i, 'start ');

  // Strip possessives for cleaner titles: "my Java assignment" -> "Java assignment"
  title = title.replace(/\bmy\s+(java|assignment|groceries|course|work|tasks?)\b/gi, '$1');

  // Strip date references from title to make it punchy (e.g. "by tomorrow", "today at 6 PM")
  title = title.replace(/\b(by tomorrow|tomorrow|today at \d+(?::\d+)?\s*(?:am|pm)?|today|next week|at \d+(?::\d+)?\s*(?:am|pm))\b/gi, '');

  // Strip trailing punctuation
  title = title.replace(/[.,:;!?]+$/, '').trim();

  // If empty or too short, revert
  if (title.length < 3) title = text;

  // Capitalize first letter
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function extractDateTime(text) {
  const lower = text.toLowerCase();
  const now = new Date();
  let targetDate = null;
  let targetTime = null;
  let formatted = null;
  let hasTime = false;

  // Extract explicit time (e.g. 6 PM, 6:30 PM, 11 AM)
  const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeMatch) {
    hasTime = true;
    let hours = parseInt(timeMatch[1], 10);
    const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3].toLowerCase();

    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    targetTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  // Date keywords
  if (lower.includes('today')) {
    targetDate = formatDateISO(now);
    formatted = 'Today' + (targetTime ? `, ${formatDisplayTime(targetTime)}` : '');
  } else if (lower.includes('tomorrow')) {
    const tmrw = new Date(now.getTime() + 86400000);
    targetDate = formatDateISO(tmrw);
    formatted = 'Tomorrow' + (targetTime ? `, ${formatDisplayTime(targetTime)}` : '');
  } else if (lower.includes('next week')) {
    const nextWk = new Date(now.getTime() + 7 * 86400000);
    targetDate = formatDateISO(nextWk);
    formatted = 'Next week';
  } else if (lower.includes('friday')) {
    targetDate = getNextDayOfWeek(5);
    formatted = 'Friday' + (targetTime ? `, ${formatDisplayTime(targetTime)}` : '');
  } else if (lower.includes('monday')) {
    targetDate = getNextDayOfWeek(1);
    formatted = 'Monday' + (targetTime ? `, ${formatDisplayTime(targetTime)}` : '');
  }

  return {
    date: targetDate,
    time: targetTime,
    formatted: formatted || (targetDate ? targetDate : 'None'),
    hasTime: hasTime
  };
}

function extractTags(text, title, category) {
  const tags = new Set();
  const combined = (text + ' ' + title).toLowerCase();

  const domainKeywords = {
    college: ['college', 'university', 'assignment', 'exam', 'professor', 'semester'],
    java: ['java', 'jvm', 'spring'],
    programming: ['code', 'coding', 'python', 'github', 'dev', 'developer', 'software'],
    learning: ['course', 'learn', 'study', 'machine learning', 'ai', 'data science', 'reading'],
    shopping: ['groceries', 'buy', 'supermarket', 'store', 'milk', 'bread'],
    errands: ['pick up', 'clean', 'dry cleaning', 'post office'],
    work: ['presentation', 'slide deck', 'client', 'meeting', 'q4', 'deck', 'report'],
    project: ['project', 'app', 'website', 'startup', 'build'],
    health: ['workout', 'gym', 'hydrate', 'run', 'doctor', 'medicine']
  };

  Object.entries(domainKeywords).forEach(([tag, keywords]) => {
    if (keywords.some(kw => combined.includes(kw))) {
      tags.add(tag);
    }
  });

  // Category fallback tag if empty
  if (tags.size === 0) {
    tags.add(category);
  }

  return Array.from(tags).slice(0, 3);
}

// Date helpers
function getRelativeDateOffset(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return formatDateISO(d);
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const meridiem = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${meridiem}`;
}

function getNextDayOfWeek(targetDay) {
  const d = new Date();
  const currentDay = d.getDay();
  let distance = targetDay - currentDay;
  if (distance <= 0) distance += 7;
  d.setDate(d.getDate() + distance);
  return formatDateISO(d);
}

// ==================== REVIEW SCREEN (FR-13: P0 Requirement) ====================
function openReviewScreen(items, rawTranscript) {
  appState.stagedReviewItems = items;
  const modal = document.getElementById('reviewModal');
  const listEl = document.getElementById('reviewItemsList');
  const transcriptEl = document.getElementById('reviewOriginalTranscript');
  const audioIndicator = document.getElementById('reviewAudioIndicator');

  transcriptEl.textContent = `"${rawTranscript}"`;

  if (appState.lastRecordedAudioUrl) {
    audioIndicator.classList.remove('hidden');
  } else {
    audioIndicator.classList.add('hidden');
  }

  renderReviewItems();
  modal.classList.remove('hidden');
  lucide.createIcons();
}

function renderReviewItems() {
  const listEl = document.getElementById('reviewItemsList');
  listEl.innerHTML = '';

  if (appState.stagedReviewItems.length === 0) {
    listEl.innerHTML = `<p class="text-sm text-slate-400 italic text-center py-6">No items remaining. You can add one manually or discard.</p>`;
    return;
  }

  appState.stagedReviewItems.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-sm space-y-3';
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1">
          <input 
            type="text" 
            value="${escapeHtml(item.title)}" 
            data-index="${index}" 
            data-field="title"
            class="review-input-field w-full font-semibold text-sm text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none py-0.5 bg-transparent"
          >
          <div class="text-[11px] text-slate-400 italic mt-0.5">From: "${escapeHtml(item.originalText || item.title)}"</div>
        </div>
        <div class="flex items-center gap-2">
          <!-- Confidence Badge (FR-12) -->
          <span class="text-[10px] px-2 py-0.5 rounded-full font-medium ${item.confidence > 0.9 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}" title="AI Classification Confidence">
            ${Math.round((item.confidence || 0.9) * 100)}% match
          </span>
          <button 
            type="button" 
            onclick="removeReviewItem(${index})" 
            class="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
            title="Remove Item"
          >
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <!-- Category, Due Date, Priority Bar -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
        <div>
          <label class="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Category (FR-7)</label>
          <select 
            data-index="${index}" 
            data-field="category"
            class="review-select-field w-full text-xs font-semibold px-2 py-1 rounded bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="task" ${item.category === 'task' ? 'selected' : ''}>Task</option>
            <option value="reminder" ${item.category === 'reminder' ? 'selected' : ''}>Reminder</option>
            <option value="goal" ${item.category === 'goal' ? 'selected' : ''}>Goal / Learning</option>
            <option value="idea" ${item.category === 'idea' ? 'selected' : ''}>Idea</option>
            <option value="note" ${item.category === 'note' ? 'selected' : ''}>Note</option>
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Due Date (FR-8)</label>
          <input 
            type="date" 
            value="${item.dueDate || ''}" 
            data-index="${index}" 
            data-field="dueDate"
            class="review-input-field w-full text-xs px-2 py-1 rounded bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
        </div>

        <div>
          <label class="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Priority (FR-9)</label>
          <select 
            data-index="${index}" 
            data-field="priority"
            class="review-select-field w-full text-xs font-semibold px-2 py-1 rounded bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="High" ${item.priority === 'High' ? 'selected' : ''}>🔴 High</option>
            <option value="Medium" ${item.priority === 'Medium' ? 'selected' : ''}>🟡 Medium</option>
            <option value="Low" ${item.priority === 'Low' ? 'selected' : ''}>🔵 Low</option>
            <option value="None" ${item.priority === 'None' ? 'selected' : ''}>⚪ None</option>
          </select>
        </div>
      </div>
    `;
    listEl.appendChild(card);
  });

  // Attach live change listeners on review inputs
  listEl.querySelectorAll('.review-input-field, .review-select-field').forEach(elem => {
    elem.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      const field = e.target.dataset.field;
      appState.stagedReviewItems[idx][field] = e.target.value;
    });
  });

  lucide.createIcons();
}

function removeReviewItem(index) {
  appState.stagedReviewItems.splice(index, 1);
  renderReviewItems();
}

function saveAllReviewedItems() {
  if (appState.stagedReviewItems.length === 0) {
    document.getElementById('reviewModal').classList.add('hidden');
    return;
  }

  // Create Parent Note reference (FR-5, User Story 10)
  const rawTranscript = document.getElementById('brainDumpTextarea').value.trim();
  const noteId = `note-${Date.now()}`;
  const newNote = {
    id: noteId,
    audioUrl: appState.lastRecordedAudioUrl || null,
    transcript: rawTranscript,
    itemIds: appState.stagedReviewItems.map(i => i.id),
    createdAt: new Date().toISOString()
  };
  appState.notes.unshift(newNote);

  // Link items with noteId
  appState.stagedReviewItems.forEach(item => {
    item.noteId = noteId;
    appState.items.unshift(item);
  });

  saveData();
  document.getElementById('reviewModal').classList.add('hidden');
  document.getElementById('brainDumpTextarea').value = '';
  updateCharCount();

  renderItems();
  updateCategoryBadges();
  showToast(`Successfully organized ${appState.stagedReviewItems.length} items!`);
}

// ==================== RENDERING & VIEWS (FR-14, FR-15, FR-16, FR-17, FR-18) ====================
function renderItems() {
  const container = document.getElementById('itemsContainer');
  const emptyState = document.getElementById('emptyState');
  const viewCount = document.getElementById('currentViewCount');
  const viewTitle = document.getElementById('currentViewTitle');

  // Filter pipeline
  let filtered = [...appState.items];

  // 1. Category Filter (FR-14)
  if (appState.currentCategory !== 'all') {
    filtered = filtered.filter(item => item.category === appState.currentCategory);
    viewTitle.textContent = getCategoryDisplay(appState.currentCategory);
  } else {
    viewTitle.textContent = 'All Items';
  }

  // 2. Timeline Filter (FR-15: Today and Upcoming)
  if (appState.currentTimeline === 'today') {
    const todayISO = formatDateISO(new Date());
    filtered = filtered.filter(item => item.dueDate === todayISO);
    viewTitle.textContent = "Today's Schedule & Deadlines";
  } else if (appState.currentTimeline === 'upcoming') {
    const todayISO = formatDateISO(new Date());
    filtered = filtered.filter(item => item.dueDate && item.dueDate >= todayISO && item.status !== 'completed');
    viewTitle.textContent = 'Upcoming Deadlines';
  } else if (appState.currentTimeline === 'completed') {
    filtered = filtered.filter(item => item.status === 'completed');
    viewTitle.textContent = 'Completed Archive';
  }

  // 3. Priority Filter (FR-9)
  if (appState.currentPriority !== 'all') {
    filtered = filtered.filter(item => item.priority === appState.currentPriority);
  }

  // 4. Tag Filter (FR-11)
  if (appState.currentTag) {
    filtered = filtered.filter(item => item.tags && item.tags.includes(appState.currentTag));
    showActiveFilterBanner(`Filtered by tag: #${appState.currentTag}`);
  }

  // 5. Search Query (FR-17)
  if (appState.searchQuery.trim()) {
    const query = appState.searchQuery.toLowerCase();
    filtered = filtered.filter(item => {
      const matchTitle = item.title.toLowerCase().includes(query);
      const matchCategory = item.category.toLowerCase().includes(query);
      const matchTags = item.tags && item.tags.some(t => t.toLowerCase().includes(query));
      const matchOriginal = item.originalText && item.originalText.toLowerCase().includes(query);
      return matchTitle || matchCategory || matchTags || matchOriginal;
    });
    showActiveFilterBanner(`Search results for "${appState.searchQuery}"`);
  }

  // Sort Pipeline
  filtered.sort((a, b) => {
    if (appState.sortBy === 'dueDate') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    } else if (appState.sortBy === 'priority') {
      const weight = { 'High': 3, 'Medium': 2, 'Low': 1, 'None': 0 };
      return (weight[b.priority] || 0) - (weight[a.priority] || 0);
    } else if (appState.sortBy === 'category') {
      return a.category.localeCompare(b.category);
    } else {
      // Newest first
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  viewCount.textContent = filtered.length;

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = '';

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = `item-card rounded-xl p-4 shadow-sm flex flex-col justify-between gap-3 ${item.status === 'completed' ? 'completed' : ''}`;
    card.id = `item-card-${item.id}`;

    // Find linked note for audio playback (FR-5, User Story 10)
    const linkedNote = appState.notes.find(n => n.id === item.noteId);
    const hasAudio = linkedNote && linkedNote.audioUrl;

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        
        <div class="flex items-start gap-3 flex-1 min-w-0">
          <!-- Complete Checkbox (FR-16) -->
          <input 
            type="checkbox" 
            ${item.status === 'completed' ? 'checked' : ''} 
            onchange="toggleItemComplete('${item.id}')"
            class="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            title="Mark Complete"
          >

          <div class="space-y-1 min-w-0 flex-1">
            
            <!-- Category Badge & Priority & Due Tag -->
            <div class="flex items-center flex-wrap gap-2 text-xs">
              <span class="badge-category ${item.category}">
                ${getCategoryIcon(item.category)}
                ${getCategoryDisplay(item.category)}
              </span>

              ${item.priority && item.priority !== 'None' ? `
                <span class="badge-priority priority-${item.priority.toLowerCase()}">
                  ${item.priority}
                </span>
              ` : ''}

              ${item.dueDate ? `
                <span class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  <i data-lucide="calendar" class="w-3 h-3 text-slate-400"></i>
                  ${formatDueDisplay(item.dueDate, item.dueTime)}
                </span>
              ` : ''}

              <!-- Promote to Task Quick Button if Idea (FR-18) -->
              ${item.category === 'idea' ? `
                <button 
                  onclick="promoteIdeaToTask('${item.id}')" 
                  class="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200 transition-colors"
                  title="Promote Idea to actionable Task"
                >
                  <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
                  Promote to Task (FR-18)
                </button>
              ` : ''}
            </div>

            <!-- Title (FR-10) -->
            <h4 class="item-title text-base font-semibold text-slate-800 leading-snug">
              ${escapeHtml(item.title)}
            </h4>

            <!-- Original Spoken Transcript Quote (FR-4, FR-5) -->
            ${item.originalText ? `
              <p class="text-xs text-slate-400 italic line-clamp-1">
                "${escapeHtml(item.originalText)}"
              </p>
            ` : ''}

            <!-- Tags (FR-11) -->
            ${item.tags && item.tags.length > 0 ? `
              <div class="flex items-center flex-wrap gap-1 pt-1">
                ${item.tags.map(tag => `
                  <span onclick="filterByTag('${escapeHtml(tag)}')" class="tag-pill cursor-pointer">
                    #${escapeHtml(tag)}
                  </span>
                `).join('')}
              </div>
            ` : ''}

          </div>
        </div>

        <!-- Action Dropdown & Audio Replay Button (FR-5, FR-16, FR-18) -->
        <div class="flex items-center gap-1">
          ${hasAudio ? `
            <button 
              onclick="playItemAudio('${linkedNote.audioUrl}')" 
              class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
              title="Replay Spoken Recording (FR-5)"
            >
              <i data-lucide="volume-2" class="w-4 h-4"></i>
            </button>
          ` : ''}

          <!-- Quick Category Switcher (FR-18) -->
          <div class="relative inline-block">
            <select 
              onchange="changeItemCategory('${item.id}', this.value)" 
              class="text-[11px] text-slate-500 bg-transparent hover:bg-slate-100 rounded p-1 border-0 focus:outline-none cursor-pointer"
              title="Change Category (FR-18)"
            >
              <option value="task" ${item.category === 'task' ? 'selected' : ''}>&rarr; Task</option>
              <option value="reminder" ${item.category === 'reminder' ? 'selected' : ''}>&rarr; Reminder</option>
              <option value="goal" ${item.category === 'goal' ? 'selected' : ''}>&rarr; Goal</option>
              <option value="idea" ${item.category === 'idea' ? 'selected' : ''}>&rarr; Idea</option>
              <option value="note" ${item.category === 'note' ? 'selected' : ''}>&rarr; Note</option>
            </select>
          </div>

          <!-- Edit button (FR-16) -->
          <button onclick="openEditModal('${item.id}')" class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Edit">
            <i data-lucide="edit-3" class="w-4 h-4"></i>
          </button>

          <!-- Delete button (FR-16) -->
          <button onclick="deleteItem('${item.id}')" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>

      </div>
    `;

    container.appendChild(card);
  });

  lucide.createIcons();
}

function updateCategoryBadges() {
  const counts = {
    all: appState.items.length,
    task: appState.items.filter(i => i.category === 'task').length,
    reminder: appState.items.filter(i => i.category === 'reminder').length,
    goal: appState.items.filter(i => i.category === 'goal').length,
    idea: appState.items.filter(i => i.category === 'idea').length,
    note: appState.items.filter(i => i.category === 'note').length
  };

  const todayISO = formatDateISO(new Date());
  const todayCount = appState.items.filter(i => i.dueDate === todayISO).length;
  const upcomingCount = appState.items.filter(i => i.dueDate && i.dueDate >= todayISO && i.status !== 'completed').length;
  const completedCount = appState.items.filter(i => i.status === 'completed').length;

  document.getElementById('badge-count-all').textContent = counts.all;
  document.getElementById('badge-count-task').textContent = counts.task;
  document.getElementById('badge-count-reminder').textContent = counts.reminder;
  document.getElementById('badge-count-goal').textContent = counts.goal;
  document.getElementById('badge-count-idea').textContent = counts.idea;
  document.getElementById('badge-count-note').textContent = counts.note;

  document.getElementById('badge-count-today').textContent = todayCount;
  document.getElementById('badge-count-upcoming').textContent = upcomingCount;
  document.getElementById('badge-count-completed').textContent = completedCount;

  renderTagCloud();
}

function renderTagCloud() {
  const container = document.getElementById('tagCloudContainer');
  const allTags = new Set();
  appState.items.forEach(i => {
    if (i.tags) i.tags.forEach(t => allTags.add(t));
  });

  if (allTags.size === 0) {
    container.innerHTML = `<span class="text-xs text-slate-400 italic">No tags detected yet</span>`;
    return;
  }

  container.innerHTML = '';
  allTags.forEach(tag => {
    const pill = document.createElement('button');
    const isActive = appState.currentTag === tag;
    pill.className = `tag-pill text-xs ${isActive ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}`;
    pill.textContent = `#${tag}`;
    pill.onclick = () => filterByTag(tag);
    container.appendChild(pill);
  });
}

// ==================== ITEM CRUD OPERATIONS (FR-16, FR-18) ====================
function toggleItemComplete(id) {
  const item = appState.items.find(i => i.id === id);
  if (!item) return;

  item.status = item.status === 'completed' ? 'pending' : 'completed';
  saveData();
  renderItems();
  updateCategoryBadges();
  showToast(item.status === 'completed' ? 'Marked complete!' : 'Marked active');
}

function promoteIdeaToTask(id) {
  const item = appState.items.find(i => i.id === id);
  if (!item) return;

  item.category = 'task';
  if (!item.priority || item.priority === 'None') item.priority = 'Medium';
  saveData();
  renderItems();
  updateCategoryBadges();
  showToast('Promoted Idea to actionable Task! (FR-18)');
}

function changeItemCategory(id, newCategory) {
  const item = appState.items.find(i => i.id === id);
  if (!item) return;

  item.category = newCategory;
  saveData();
  renderItems();
  updateCategoryBadges();
  showToast(`Converted item to ${getCategoryDisplay(newCategory)}`);
}

function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  appState.items = appState.items.filter(i => i.id !== id);
  saveData();
  renderItems();
  updateCategoryBadges();
  showToast('Item deleted');
}

// ==================== EDIT & MANUAL ADD MODAL ====================
function openEditModal(id = null) {
  const modal = document.getElementById('editModal');
  const titleEl = document.getElementById('editModalTitle');
  const form = document.getElementById('editItemForm');

  if (id) {
    const item = appState.items.find(i => i.id === id);
    if (!item) return;
    titleEl.textContent = 'Edit Item (FR-16)';
    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemTitle').value = item.title;
    document.getElementById('editItemCategory').value = item.category;
    document.getElementById('editItemPriority').value = item.priority || 'None';
    document.getElementById('editItemDueDate').value = item.dueDate || '';
    document.getElementById('editItemDueTime').value = item.dueTime || '';
    document.getElementById('editItemTags').value = item.tags ? item.tags.join(', ') : '';
  } else {
    titleEl.textContent = 'Add New Item';
    form.reset();
    document.getElementById('editItemId').value = '';
    document.getElementById('editItemPriority').value = 'Medium';
  }

  modal.classList.remove('hidden');
}

function handleSaveEditForm(e) {
  e.preventDefault();
  const id = document.getElementById('editItemId').value;
  const title = document.getElementById('editItemTitle').value.trim();
  const category = document.getElementById('editItemCategory').value;
  const priority = document.getElementById('editItemPriority').value;
  const dueDate = document.getElementById('editItemDueDate').value || null;
  const dueTime = document.getElementById('editItemDueTime').value || null;
  const rawTags = document.getElementById('editItemTags').value;
  const tags = rawTags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);

  if (id) {
    const item = appState.items.find(i => i.id === id);
    if (item) {
      item.title = title;
      item.category = category;
      item.priority = priority;
      item.dueDate = dueDate;
      item.dueTime = dueTime;
      item.tags = tags;
    }
  } else {
    const newItem = {
      id: `item-${Date.now()}`,
      title: title,
      category: category,
      priority: priority,
      dueDate: dueDate,
      dueTime: dueTime,
      tags: tags,
      confidence: 1.0,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    appState.items.unshift(newItem);
  }

  saveData();
  document.getElementById('editModal').classList.add('hidden');
  renderItems();
  updateCategoryBadges();
  showToast('Item saved successfully');
}

// ==================== REMINDER CHECKER & NOTIFICATIONS (FR-19, FR-20, FR-21) ====================
function startReminderChecker() {
  // Check every 30 seconds for due reminders
  setInterval(() => {
    checkDueReminders();
  }, 30000);

  // Initial check shortly after load
  setTimeout(checkDueReminders, 3000);
}

function checkDueReminders() {
  const now = new Date();
  const todayISO = formatDateISO(now);
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMins = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHours}:${currentMins}`;

  const dueItems = appState.items.filter(item => {
    if (item.status === 'completed' || !item.dueDate) return false;
    if (item.dueDate === todayISO) {
      if (!item.dueTime) return false; // Needs specific time
      return item.dueTime <= currentTime && !item.hasAlerted;
    }
    return false;
  });

  if (dueItems.length > 0) {
    const firstDue = dueItems[0];
    firstDue.hasAlerted = true;
    saveData();
    triggerReminderAlert(firstDue);
  }
}

function triggerReminderAlert(item) {
  appState.activeReminderItem = item;

  // Play gentle chime sound via Web Audio API
  playChimeSound();

  // Desktop Web Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`ThoughtSort: ${item.title}`, {
      body: `Due now (${formatDueDisplay(item.dueDate, item.dueTime)}) - [${item.category.toUpperCase()}]`,
      icon: 'favicon.ico'
    });
  }

  // In-app Toast Banner
  const toast = document.getElementById('reminderToast');
  document.getElementById('reminderToastTitle').textContent = item.title;
  toast.classList.remove('hidden');
  lucide.createIcons();
}

function playChimeSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch (e) {
    // Ignore audio autoplay restrictions if user has not interacted
  }
}

function snoozeActiveReminder(minutes = 10) {
  if (!appState.activeReminderItem) return;
  const now = new Date(Date.now() + minutes * 60000);
  appState.activeReminderItem.dueTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  appState.activeReminderItem.hasAlerted = false;
  saveData();
  document.getElementById('reminderToast').classList.add('hidden');
  showToast(`Snoozed for ${minutes} minutes (FR-21)`);
}

// ==================== EXPORT DATA (FR-23) ====================
function exportToCsv() {
  const headers = ['ID', 'Title', 'Category', 'Due Date', 'Due Time', 'Priority', 'Status', 'Tags', 'Original Transcript', 'Created At'];
  const rows = appState.items.map(i => [
    i.id,
    `"${(i.title || '').replace(/"/g, '""')}"`,
    i.category,
    i.dueDate || '',
    i.dueTime || '',
    i.priority || '',
    i.status || '',
    `"${(i.tags || []).join('; ')}"`,
    `"${(i.originalText || '').replace(/"/g, '""')}"`,
    i.createdAt
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadBlob(csvContent, 'thoughtsort_export.csv', 'text/csv;charset=utf-8;');
  showToast('Exported CSV!');
}

function exportToJson() {
  const exportPayload = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    notes: appState.notes,
    items: appState.items
  };
  const jsonContent = JSON.stringify(exportPayload, null, 2);
  downloadBlob(jsonContent, 'thoughtsort_export.json', 'application/json');
  showToast('Exported JSON!');
}

function exportToText() {
  let md = `# ThoughtSort - Exported Summary\nDate: ${new Date().toLocaleDateString()}\n\n`;

  const categories = ['task', 'reminder', 'goal', 'idea', 'note'];
  categories.forEach(cat => {
    const catItems = appState.items.filter(i => i.category === cat);
    if (catItems.length > 0) {
      md += `## ${getCategoryDisplay(cat)} (${catItems.length})\n`;
      catItems.forEach(i => {
        const checkbox = i.status === 'completed' ? '[x]' : '[ ]';
        const due = i.dueDate ? ` (Due: ${i.dueDate}${i.dueTime ? ' ' + i.dueTime : ''})` : '';
        const priority = i.priority && i.priority !== 'None' ? ` [${i.priority}]` : '';
        md += `- ${checkbox} ${i.title}${due}${priority}\n`;
      });
      md += '\n';
    }
  });

  downloadBlob(md, 'thoughtsort_summary.md', 'text/markdown');
  showToast('Exported Markdown summary!');
}

function downloadBlob(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== EVENT LISTENERS & UI WIRING ====================
function setupEventListeners() {
  // Voice Recording Toggle
  document.getElementById('recordBtn').addEventListener('click', toggleRecording);

  // Brain Dump Sort Trigger (FR-6)
  document.getElementById('processDumpBtn').addEventListener('click', () => {
    const text = document.getElementById('brainDumpTextarea').value.trim();
    if (!text) {
      showToast('Please type or record thoughts before sorting!');
      return;
    }
    const parsedItems = processBrainDump(text);
    openReviewScreen(parsedItems, text);
  });

  // Ctrl+Enter shortcut in textarea
  document.getElementById('brainDumpTextarea').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      document.getElementById('processDumpBtn').click();
    }
  });

  document.getElementById('brainDumpTextarea').addEventListener('input', updateCharCount);

  // Clear Input Button
  document.getElementById('clearInputBtn').addEventListener('click', () => {
    document.getElementById('brainDumpTextarea').value = '';
    updateCharCount();
  });

  // Preset Sample Buttons
  document.querySelectorAll('.sample-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      let text = '';
      if (preset === 'prd') {
        text = 'I have to complete my Java assignment by tomorrow. I also need to buy groceries today at 6 PM. I have been thinking about starting a machine learning course next week. Also, I have an idea for a new college project.';
      } else if (preset === 'work') {
        text = 'Need to prepare the Q4 slide deck before Friday 3 PM. Remember to call Sarah at 11 AM regarding client contracts. Think about automating our weekly status reports. Read up on system design patterns.';
      } else if (preset === 'creative') {
        text = 'Build a browser extension that saves snippets with AI tags. Follow up with Jake tomorrow morning about podcast guest ideas. Book flight tickets for design summit next month. Don\'t forget to hydrate today.';
      }
      document.getElementById('brainDumpTextarea').value = text;
      updateCharCount();
      showToast('Loaded demo sample! Tap "Sort My Thoughts" to test AI.');
    });
  });

  // Category Nav Buttons (FR-14)
  document.querySelectorAll('.cat-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-nav-btn').forEach(b => b.classList.remove('active', 'bg-indigo-50', 'text-indigo-700'));
      btn.classList.add('active', 'bg-indigo-50', 'text-indigo-700');
      appState.currentCategory = btn.dataset.cat;
      appState.currentTimeline = 'all-time';
      renderItems();
    });
  });

  // Timeline Nav Buttons (FR-15)
  document.querySelectorAll('.time-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-nav-btn').forEach(b => b.classList.remove('active', 'bg-slate-100', 'text-slate-800'));
      btn.classList.add('active', 'bg-slate-100', 'text-slate-800');
      appState.currentTimeline = btn.dataset.view;
      appState.currentCategory = 'all';
      renderItems();
    });
  });

  // Priority Filter
  document.getElementById('priorityFilterSelect').addEventListener('change', (e) => {
    appState.currentPriority = e.target.value;
    renderItems();
  });

  // Sort By
  document.getElementById('sortBySelect').addEventListener('change', (e) => {
    appState.sortBy = e.target.value;
    renderItems();
  });

  // Search Inputs (FR-17)
  const searchInput = document.getElementById('globalSearchInput');
  const mobileSearch = document.getElementById('mobileSearchInput');
  const clearSearch = document.getElementById('clearSearchBtn');

  function handleSearch(val) {
    appState.searchQuery = val;
    if (val) clearSearch.classList.remove('hidden');
    else clearSearch.classList.add('hidden');
    renderItems();
  }

  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  mobileSearch.addEventListener('input', (e) => handleSearch(e.target.value));
  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    mobileSearch.value = '';
    handleSearch('');
  });

  // Reset Filters button
  document.getElementById('resetAllFiltersBtn').addEventListener('click', () => {
    appState.searchQuery = '';
    appState.currentTag = null;
    appState.currentCategory = 'all';
    appState.currentTimeline = 'all-time';
    appState.currentPriority = 'all';
    searchInput.value = '';
    mobileSearch.value = '';
    document.getElementById('priorityFilterSelect').value = 'all';
    document.getElementById('activeFilterNotice').classList.add('hidden');
    document.getElementById('clearTagFilterBtn').classList.add('hidden');
    renderItems();
    updateCategoryBadges();
  });

  // Tag Clear
  document.getElementById('clearTagFilterBtn').addEventListener('click', () => {
    appState.currentTag = null;
    document.getElementById('clearTagFilterBtn').classList.add('hidden');
    renderItems();
  });

  // Review Modal Actions (FR-13)
  document.getElementById('saveAllReviewBtn').addEventListener('click', saveAllReviewedItems);
  document.getElementById('discardReviewBtn').addEventListener('click', () => {
    document.getElementById('reviewModal').classList.add('hidden');
  });
  document.getElementById('closeReviewModalBtn').addEventListener('click', () => {
    document.getElementById('reviewModal').classList.add('hidden');
  });
  document.getElementById('reviewAddMoreBtn').addEventListener('click', () => {
    appState.stagedReviewItems.push({
      id: `item-${Date.now()}-extra`,
      title: 'New Item',
      category: 'task',
      dueDate: null,
      dueTime: null,
      priority: 'Medium',
      confidence: 1.0,
      tags: ['custom'],
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    renderReviewItems();
  });

  // Add Manual Item Modal
  document.getElementById('addManualItemBtn').addEventListener('click', () => openEditModal());
  document.getElementById('editItemForm').addEventListener('submit', handleSaveEditForm);
  document.getElementById('cancelEditBtn').addEventListener('click', () => {
    document.getElementById('editModal').classList.add('hidden');
  });
  document.getElementById('closeEditModalBtn').addEventListener('click', () => {
    document.getElementById('editModal').classList.add('hidden');
  });

  // Reminder Toast Actions
  document.getElementById('toastDoneBtn').addEventListener('click', () => {
    if (appState.activeReminderItem) {
      toggleItemComplete(appState.activeReminderItem.id);
    }
    document.getElementById('reminderToast').classList.add('hidden');
  });
  document.getElementById('toastSnoozeBtn').addEventListener('click', () => snoozeActiveReminder(10));
  document.getElementById('dismissToastBtn').addEventListener('click', () => {
    document.getElementById('reminderToast').classList.add('hidden');
  });

  // Export Modal Triggers (FR-23)
  const exportModal = document.getElementById('exportModal');
  document.getElementById('exportBtn').addEventListener('click', () => exportModal.classList.remove('hidden'));
  document.getElementById('closeExportModalBtn').addEventListener('click', () => exportModal.classList.add('hidden'));
  document.getElementById('exportCsvBtn').addEventListener('click', exportToCsv);
  document.getElementById('exportJsonBtn').addEventListener('click', exportToJson);
  document.getElementById('exportTextBtn').addEventListener('click', exportToText);

  // PRD Spec Modal Triggers
  const prdModal = document.getElementById('prdModal');
  document.getElementById('prdModalBtn').addEventListener('click', () => prdModal.classList.remove('hidden'));
  document.getElementById('closePrdModalBtn').addEventListener('click', () => prdModal.classList.add('hidden'));
  document.getElementById('closePrdModalBottomBtn').addEventListener('click', () => prdModal.classList.add('hidden'));

  // Settings Modal Triggers
  const settingsModal = document.getElementById('settingsModal');
  document.getElementById('settingsBtn').addEventListener('click', () => settingsModal.classList.remove('hidden'));
  document.getElementById('closeSettingsModalBtn').addEventListener('click', () => settingsModal.classList.add('hidden'));
  document.getElementById('requestNotifBtn').addEventListener('click', async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      showToast(perm === 'granted' ? 'Notifications enabled!' : 'Notifications declined');
    }
  });
  document.getElementById('loadDefaultDataBtn').addEventListener('click', () => {
    appState.items = [...DEFAULT_PRD_ITEMS];
    appState.notes = [DEFAULT_PRD_NOTE];
    saveData();
    renderItems();
    updateCategoryBadges();
    settingsModal.classList.add('hidden');
    showToast('Loaded default PRD example data');
  });
  document.getElementById('clearAllDataBtn').addEventListener('click', () => {
    if (confirm('Clear all stored thoughts and notes?')) {
      appState.items = [];
      appState.notes = [];
      saveData();
      renderItems();
      updateCategoryBadges();
      settingsModal.classList.add('hidden');
      showToast('All data cleared');
    }
  });

  // Theme Toggle
  const themeBtn = document.getElementById('themeToggleBtn');
  themeBtn.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.body.removeAttribute('data-theme');
      document.getElementById('themeIcon').setAttribute('data-lucide', 'moon');
    } else {
      document.body.setAttribute('data-theme', 'dark');
      document.getElementById('themeIcon').setAttribute('data-lucide', 'sun');
    }
    lucide.createIcons();
  });
}

function filterByTag(tag) {
  appState.currentTag = tag;
  document.getElementById('clearTagFilterBtn').classList.remove('hidden');
  renderItems();
  updateCategoryBadges();
}

function showActiveFilterBanner(text) {
  const banner = document.getElementById('activeFilterNotice');
  document.getElementById('activeFilterText').textContent = text;
  banner.classList.remove('hidden');
  banner.classList.add('flex');
}

function updateCharCount() {
  const count = document.getElementById('brainDumpTextarea').value.length;
  document.getElementById('charCount').textContent = `${count} characters`;
}

function playItemAudio(url) {
  const audio = new Audio(url);
  audio.play();
  showToast('Playing original voice recording snippet...');
}

// ==================== HELPERS & FORMATTERS ====================
function getCategoryDisplay(cat) {
  switch (cat) {
    case 'task': return 'Task';
    case 'reminder': return 'Reminder';
    case 'goal': return 'Goal / Learning';
    case 'idea': return 'Idea';
    case 'note': return 'Note';
    default: return cat;
  }
}

function getCategoryIcon(cat) {
  switch (cat) {
    case 'task': return '<i data-lucide="check-square" class="w-3.5 h-3.5"></i>';
    case 'reminder': return '<i data-lucide="bell" class="w-3.5 h-3.5"></i>';
    case 'goal': return '<i data-lucide="target" class="w-3.5 h-3.5"></i>';
    case 'idea': return '<i data-lucide="lightbulb" class="w-3.5 h-3.5"></i>';
    case 'note': return '<i data-lucide="file-text" class="w-3.5 h-3.5"></i>';
    default: return '';
  }
}

function formatDueDisplay(dateStr, timeStr) {
  if (!dateStr) return '';
  const todayISO = formatDateISO(new Date());
  const tmrwISO = getRelativeDateOffset(1);

  let label = dateStr;
  if (dateStr === todayISO) label = 'Today';
  else if (dateStr === tmrwISO) label = 'Tomorrow';

  if (timeStr) {
    label += ` at ${formatDisplayTime(timeStr)}`;
  }
  return label;
}

function showToast(message) {
  const toast = document.getElementById('actionToast');
  const msgEl = document.getElementById('actionToastMessage');
  msgEl.textContent = message;
  toast.classList.remove('opacity-0', 'translate-y-[-20px]', 'pointer-events-none');
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-[-20px]', 'pointer-events-none');
  }, 2800);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}
