/* ── APP STATE ────────────────────────────────────────────────
   Central mutable state object.
   All modules read from / write to S and the globals below.
   ─────────────────────────────────────────────────────────── */

let ACTIVE_CRITERIA = null;

const S = {
  pose: null,
  camera: null,
  stream: null,
  running: false,
  sessionStart: null,
  timerInterval: null,
  wristYHistory: [],
  lastPeakTime: null,
  compressionTimes: [],
  compressionCount: 0,
  currentBPM: 0,
  dimensionScoreHistory: {},
  frameCount: 0,
  poseDetected: false,
  latestPoseSignals: {}
};

const RHYTHM_BARS = 32;
let rhythmData = new Array(RHYTHM_BARS).fill(0);
let simInterval = null;
let lastFeedbackUpdate = 0;

/* ── NAVIGATION ──────────────────────────────────────────── */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  window.scrollTo(0, 0);
}

function goHome() {
  cleanup();
  showPage('home');
}

/* ── SKILL GRID ──────────────────────────────────────────── */
function buildSkillGrid() {
  document.getElementById('skillGrid').innerHTML = CRITERIA_DB.skills.map(sk => `
    <div class="skill-card" data-id="${sk.id}" onclick="selectSkill('${sk.id}')">
      <div class="skill-card-icon">${sk.emoji}</div>
      <div><div class="skill-card-name">${sk.name}</div><div class="skill-card-tag">${sk.tag}</div></div>
    </div>`).join('');
}

function selectSkill(id) {
  const c = CRITERIA_DB.skills.find(s => s.id === id);
  if (!c) return;
  ACTIVE_CRITERIA = c;
  document.querySelectorAll('.skill-card').forEach(el => el.classList.toggle('selected', el.dataset.id === id));
  document.getElementById('sourceChip').href = c.source.url;
  document.getElementById('sourceChipLabel').textContent = c.source.label;
  document.getElementById('sourceChipWrap').style.display = 'block';
  document.getElementById('criteriaPreview').innerHTML = c.dimensions
    .map(d => `<span class="criteria-tag">${d.name} (${Math.round(d.weight * 100)}%)</span>`).join('');
  document.getElementById('startBtn').classList.add('ready');
}

/* ── PRACTICE SETUP ──────────────────────────────────────── */
function startPractice() {
  if (!ACTIVE_CRITERIA) return;
  S.dimensionScoreHistory = {};
  ACTIVE_CRITERIA.dimensions.forEach(d => { S.dimensionScoreHistory[d.id] = []; });
  document.getElementById('skillBadgePractice').textContent = ACTIVE_CRITERIA.name;
  document.getElementById('pmLabel').textContent = ACTIVE_CRITERIA.primary_metric.label;
  document.getElementById('pmTarget').textContent = ACTIVE_CRITERIA.primary_metric.target_display;
  document.getElementById('pmUnit').textContent = ACTIVE_CRITERIA.primary_metric.unit;
  document.getElementById('timerDisp').textContent = '0:' + String(ACTIVE_CRITERIA.session_duration).padStart(2, '0');
  document.getElementById('liveCriteriaScores').innerHTML = ACTIVE_CRITERIA.dimensions.map(d => `
    <div class="score-row-mini">
      <span class="score-name-mini">${d.name}</span>
      <div class="score-bar-mini"><div class="score-bar-fill" id="sb-${d.id}" style="width:0%"></div></div>
      <span class="score-pct-mini" id="sv-${d.id}">0%</span>
    </div>`).join('');
  showPage('practice');
  initRhythmBars();
  showCamState('stateIdle');
  document.getElementById('session-status').textContent = 'Ready';
}

/* ── RETRY / CLEANUP ─────────────────────────────────────── */
function retrySession() {
  Object.assign(S, {
    pose: null, camera: null, stream: null, running: false, sessionStart: null, timerInterval: null,
    wristYHistory: [], lastPeakTime: null, compressionTimes: [], compressionCount: 0,
    currentBPM: 0, dimensionScoreHistory: {}, frameCount: 0, poseDetected: false, latestPoseSignals: {}
  });
  if (ACTIVE_CRITERIA) ACTIVE_CRITERIA.dimensions.forEach(d => { S.dimensionScoreHistory[d.id] = []; });
  rhythmData = new Array(RHYTHM_BARS).fill(0);
  lastFeedbackUpdate = 0;
  document.getElementById('videoEl').style.display = 'none';
  document.getElementById('poseCanvas').style.display = 'none';
  document.getElementById('liveOverlay').style.display = 'none';
  document.getElementById('rhythmSection').style.display = 'none';
  document.getElementById('pmVal').textContent = '—';
  document.getElementById('pmVal').className = 'color-neutral';
  document.getElementById('pmStatus').textContent = 'Begin to measure';
  document.getElementById('pmBar').style.width = '0%';
  document.getElementById('compCount').textContent = '0';
  document.getElementById('compSub').textContent = 'No actions detected';
  document.getElementById('poseDot').classList.remove('on');
  document.getElementById('poseLabel').textContent = 'Pose not detected';
  document.getElementById('feedbackList').innerHTML = '<div class="fb-item fb-warn"><span class="fb-icon">⚡</span><span>Enable camera to begin.</span></div>';
  document.getElementById('session-status').textContent = 'Ready';
  showPage('practice');
  initRhythmBars();
  showCamState('stateIdle');
}

function cleanup() {
  S.running = false;
  if (simInterval)     { clearInterval(simInterval); simInterval = null; }
  if (S.timerInterval) { clearInterval(S.timerInterval); S.timerInterval = null; }
  if (S.camera)  { try { S.camera.stop(); }  catch (e) {} S.camera = null; }
  if (S.stream)  { S.stream.getTracks().forEach(t => t.stop()); S.stream = null; }
  if (S.pose)    { try { S.pose.close(); }   catch (e) {} S.pose = null; }
   const video = document.getElementById('videoEl');
if (video) {
  video.srcObject = null;
  video.style.display = 'none';
}
}

/* ── KEYBOARD SHORTCUT (S = demo mode) ──────────────────── */
document.addEventListener('keydown', e => {
  if ((e.key === 'S' || e.key === 's') && S.running && !e.target.matches('input,textarea,select')) {
    startSimMode();
    notify('Demo mode activated');
  }
});

/* ── INIT ────────────────────────────────────────────────── */
buildSkillGrid();
