/* ── SESSION LOGIC ───────────────────────────────────────────
   Timer, BPM calculation, rhythm wave, live feedback,
   live score updates, simulation mode, and results builder.
   ─────────────────────────────────────────────────────────── */

/* ── TIMER ───────────────────────────────────────────────── */
function startTimer() {
  const dur  = ACTIVE_CRITERIA?.session_duration || 30;
  S.sessionStart = Date.now();
  const disp = document.getElementById('timerDisp');

  S.timerInterval = setInterval(() => {
    const rem = Math.max(0, dur - (Date.now() - S.sessionStart) / 1000);
    const s   = Math.ceil(rem);
    disp.textContent = '0:' + String(s).padStart(2, '0');

    if      (rem <= 5)  disp.classList.add('urgent');
    else if (rem <= 10) disp.style.color = 'var(--warn)';
    else                { disp.classList.remove('urgent'); disp.style.color = 'var(--text)'; }

    if (rem <= 0) {
      clearInterval(S.timerInterval);
      S.running = false;
      buildResults();
    }
  }, 200);
}

function stopSession() {
  clearInterval(S.timerInterval);
  S.running = false;
  buildResults();
}

/* ── RHYTHM WAVE ─────────────────────────────────────────── */
function initRhythmBars() {
  const wave = document.getElementById('rhythmWave');
  wave.innerHTML = '';
  rhythmData = new Array(RHYTHM_BARS).fill(0);
  for (let i = 0; i < RHYTHM_BARS; i++) {
    const b = document.createElement('div');
    b.className  = 'r-bar';
    b.style.height = '4px';
    wave.appendChild(b);
  }
}

function addRhythmSpike() {
  rhythmData.push(100);
  if (rhythmData.length > RHYTHM_BARS) rhythmData.shift();
  renderRhythm();
  setTimeout(() => { if (rhythmData.length) rhythmData[rhythmData.length - 1] = 55;  renderRhythm(); }, 80);
  setTimeout(() => { if (rhythmData.length) rhythmData[rhythmData.length - 1] = 22;  renderRhythm(); }, 200);
  setTimeout(() => { if (rhythmData.length) rhythmData[rhythmData.length - 1] = 7;   renderRhythm(); }, 400);
}

function renderRhythm() {
  document.querySelectorAll('.r-bar').forEach((bar, i) => {
    const h = rhythmData[i] || 0;
    bar.style.height     = Math.max(4, h * 0.35) + 'px';
    bar.style.background = h > 50
      ? 'var(--accent)'
      : h > 20
        ? 'rgba(59,130,246,0.4)'
        : 'var(--surface3)';
  });
}

/* ── WRIST MOVEMENT & BPM ────────────────────────────────── */
function processWristMovement(wristY, now) {
  S.wristYHistory.push({ y: wristY, t: now });
  if (S.wristYHistory.length > 20) S.wristYHistory.shift();
  if (S.wristYHistory.length < 6)  return;

  const recent = S.wristYHistory.slice(-5);
  const old    = S.wristYHistory.slice(-10, -5);
  if (old.length < 5) return;

  const rA = recent.reduce((s, v) => s + v.y, 0) / recent.length;
  const oA = old.reduce((s, v)    => s + v.y, 0) / old.length;

// 🔴 FIX: رفع عتبة الكشف لتجنب الكشف الوهمي
  // القديم كان: rA - oA > 0.011
  // الجديد:
  if (rA - oA > 0.025 && (!S.lastPeakTime || now - S.lastPeakTime > 350)) {
     S.lastPeakTime = now;
    S.compressionCount++;
    S.compressionTimes.push(now);
    if (S.compressionTimes.length > 30) S.compressionTimes.shift();

    document.getElementById('compCount').textContent = S.compressionCount;
    document.getElementById('compSub').textContent   = `${S.compressionCount} action${S.compressionCount !== 1 ? 's' : ''} detected`;

    addRhythmSpike();
    calcBPM();
  }
}

function calcBPM() {
  const t = S.compressionTimes;
  if (t.length < 3) return;
  const last = t.slice(-12);
  const iv   = [];
  for (let i = 1; i < last.length; i++) iv.push(last[i] - last[i - 1]);
   const avgInterval = iv.reduce((a, b) => a + b, 0) / iv.length;
  
  // 🔴 FIX: تجاهل فترات غير منطقية (أقل من 300ms = أكثر من 200 BPM حقيقي)
  if (avgInterval < 300) return;

   S.currentBPM = Math.max(0, Math.min(200, Math.round(60000 / avgInterval)));
   updatePMDisplay(S.currentBPM);
   
   //:الشرط قبل التعديل
  //S.currentBPM = Math.max(0, Math.min(240, Math.round(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length))));
  //updatePMDisplay(S.currentBPM);
}

function updatePMDisplay(bpm) {
  const el  = document.getElementById('pmVal');
  const st  = document.getElementById('pmStatus');
  const bar = document.getElementById('pmBar');
  if (!ACTIVE_CRITERIA) return;

  const { target_min: mn, target_max: mx } = ACTIVE_CRITERIA.primary_metric;
  el.textContent = bpm;
  bar.style.width = Math.max(0, Math.min(100, ((bpm - (mn - 20)) / ((mx + 20) - (mn - 20))) * 100)) + '%';

  if      (bpm < mn - 20) { el.className = 'color-bad';  st.textContent = 'Too slow';                  bar.style.background = 'var(--bad)';  }
  else if (bpm < mn)      { el.className = 'color-warn'; st.textContent = 'Slightly slow — speed up';  bar.style.background = 'var(--warn)'; }
  else if (bpm <= mx)     { el.className = 'color-good'; st.textContent = 'Perfect — maintain this pace'; bar.style.background = 'var(--good)'; }
  else if (bpm <= mx + 20){ el.className = 'color-warn'; st.textContent = 'Slightly fast — ease off';  bar.style.background = 'var(--warn)'; }
  else                    { el.className = 'color-bad';  st.textContent = 'Too fast';                  bar.style.background = 'var(--bad)';  }
}

/* ── LIVE FEEDBACK & SCORES ──────────────────────────────── */
function generateFeedback(breakdown) {
  const now = Date.now();
  if (now - lastFeedbackUpdate < 1400) return;
  lastFeedbackUpdate = now;

 const msgs = S.compressionCount < 3
  ? [{ cls: 'fb-warn', icon: '⚡', text: 'Align with the guide outline — then begin' }]
    : breakdown.map(d => ({
        cls:  d.score >= 75 ? 'fb-good' : d.score >= 40 ? 'fb-warn' : 'fb-bad',
        icon: d.score >= 75 ? '✓'       : d.score >= 40 ? '🟡'      : '🔴',
        text: d.feedback
      }));

  if (!S.poseDetected && S.compressionCount > 0)
    msgs.push({ cls: 'fb-warn', icon: '👁', text: 'Move into frame for pose analysis' });

  document.getElementById('feedbackList').innerHTML = msgs
    .map(m => `<div class="fb-item ${m.cls}"><span class="fb-icon">${m.icon}</span><span>${m.text}</span></div>`)
    .join('');
}

function updateLiveScores() {
  if (!ACTIVE_CRITERIA) return;
 ACTIVE_CRITERIA.dimensions.forEach(d => {
    const h      = S.dimensionScoreHistory[d.id] || [];
    const recent = h.slice(-20);
    
    // 🔴 FIX: لا تعرض نتائج إذا لم يكن هناك نشاط
    const avg = (recent.length && S.compressionCount >= 3)
      ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
      : 0;
      
    const sb = document.getElementById('sb-' + d.id);
    const sv = document.getElementById('sv-' + d.id);
    if (sb) {
      sb.style.width      = avg + '%';
      sb.style.background = avg >= 75 ? 'var(--good)' : avg >= 50 ? 'var(--warn)' : 'var(--bad)';
    }
    if (sv) sv.textContent = avg + '%';
  });
}

/* ── SIMULATION MODE ─────────────────────────────────────── */
function startSimMode() {
  if (simInterval) return; // prevent double-start

  document.getElementById('session-status').textContent = 'Demo Mode';
  notify('Running in demo mode.');
  setPoseStatus(true);

  simInterval = setInterval(() => {
    if (!S.running || !ACTIVE_CRITERIA) return;
    const now = Date.now();
    const pm  = ACTIVE_CRITERIA.primary_metric;
    const targetBPM = (pm.target_min + pm.target_max) / 2 + Math.sin(now / 9000) * 6 + (Math.random() - .5) * 4;

    if (!S.lastPeakTime || (now - S.lastPeakTime) >= 60000 / targetBPM * 0.92)
      processWristMovement(0.58, now);

    const ps = {
      wrist_center_x: 0.50 + Math.sin(now / 3000) * 0.05 + (Math.random() - .5) * 0.04,
      wrist_center_y: 0.60 + Math.sin(now / 4000) * 0.04,
      arm_angle:      162  + Math.sin(now / 5000) * 12 + (Math.random() - .5) * 8,
      elbow_angle:    158  + Math.cos(now / 4500) * 10,
      body_lean:      15   + Math.sin(now / 7000) * 6,
      shoulder_level: Math.abs(Math.sin(now / 6000)) * 0.05,
      hand_height:    0.45 + Math.sin(now / 3500) * 0.06
    };

    S.latestPoseSignals = ps;
    S.frameCount++;

    const { breakdown } = HeuristicScorer.scoreAll(ACTIVE_CRITERIA, ps, S.currentBPM, S.compressionTimes);
    breakdown.forEach(d => {
      if (!S.dimensionScoreHistory[d.id]) S.dimensionScoreHistory[d.id] = [];
      S.dimensionScoreHistory[d.id].push(d.score);
    });

    drawSimSkeleton();
    updateLiveScores();
    generateFeedback(breakdown);
  }, 90);
}

/* ── RESULTS BUILDER ─────────────────────────────────────── */
function buildResults() {
  const criteria = ACTIVE_CRITERIA;
  if (!criteria) { showPage('results'); return; }
   
// 🔴 FIX: إذا لم تُسجَّل حركات كافية، أعطِ نتيجة صفر مع رسالة
  if (S.compressionCount < 3) {
    cleanup();
    document.getElementById('resultEyebrow').textContent = `Session Report — ${criteria.name}`;
    document.getElementById('result-title').textContent = 'No Activity Detected';
    document.getElementById('score-grade').textContent = 'N/A';
    document.getElementById('score-grade').style.color = 'var(--text-dim)';
    document.getElementById('score-grade-desc').textContent = 
      'No actions were recorded. Please enable camera and perform the skill.';
    document.getElementById('final-score-num').textContent = '0';
    document.getElementById('breakdown-grid').innerHTML = 
      `<div style="text-align:center;color:var(--text-dim);font-family:var(--fm);padding:24px;">
        No movement detected during the session.
      </div>`;
    document.getElementById('tips-list').innerHTML = criteria.improvement_tips
      .map((t, i) => `<div class="tip-item"><span class="tip-num">0${i + 1}</span><span>${t}</span></div>`)
      .join('');
    showPage('results');
    return;
  }
   
  const finalBreakdown = criteria.dimensions.map(d => {
    const h   = S.dimensionScoreHistory[d.id] || [];
    const avg = h.length ? Math.round(h.reduce((a, b) => a + b, 0) / h.length) : 30;
    return { ...d, finalScore: avg };
  });

  const final       = Math.round(finalBreakdown.reduce((s, d) => s + d.finalScore * d.weight, 0));
  const consistency = HeuristicScorer.scoreConsistency(S.compressionTimes);
  cleanup();

  document.getElementById('resultEyebrow').textContent = `Session Report — ${criteria.name}`;

  // Score arc animation
  const arc = document.getElementById('score-arc');
  const col = final >= 80 ? 'var(--good)' : final >= 60 ? 'var(--warn)' : 'var(--bad)';
  setTimeout(() => {
    arc.style.strokeDashoffset = 439.8 - (final / 100) * 439.8;
    arc.style.stroke           = col;
  }, 300);

  // Score number count-up
  const numEl = document.getElementById('final-score-num');
  numEl.style.color = col;
  let n = 0;
  const inc = setInterval(() => {
    n = Math.min(final, n + 2);
    numEl.textContent = n;
    if (n >= final) clearInterval(inc);
  }, 28);

  // Grade lookup
  const grades = [
    [90, 'Excellent', 'Outstanding technique. Well prepared for real-world application.'],
    [80, 'Good',      'Strong performance with minor areas to improve.'],
    [70, 'Proficient','Solid technique. Focus on the flagged areas.'],
    [60, 'Developing','Making progress — continue practising fundamentals.'],
    [0,  'Needs Work','Review clinical guidelines and practise again.']
  ];
  const [, grade, desc] = grades.find(([min]) => final >= min);
  document.getElementById('result-title').textContent        = grade + ' Performance';
  document.getElementById('score-grade').textContent         = grade;
  document.getElementById('score-grade').style.color         = col;
  document.getElementById('score-grade-desc').textContent    = desc;

  // Breakdown cards
  document.getElementById('breakdown-grid').innerHTML = finalBreakdown.map(d => {
    const s  = d.finalScore;
    const c  = s >= 75 ? 'var(--good)' : s >= 50 ? 'var(--warn)' : 'var(--bad)';
    const fb = s >= 75 ? d.good_feedback : s >= 40 ? d.warn_feedback : d.bad_feedback;
    return `<div class="breakdown-card">
      <div class="bc-header"><span class="bc-name">${d.name}</span><span class="bc-weight">${Math.round(d.weight * 100)}%</span></div>
      <div class="bc-score" style="color:${c}">${s}/100</div>
      <div class="bc-bar"><div class="bc-bar-fill" id="bb-${d.id}" style="width:0%;background:${c}"></div></div>
      <div class="bc-feedback">${fb}</div>
    </div>`;
  }).join('');

  setTimeout(() => {
    finalBreakdown.forEach(d => {
      const el = document.getElementById('bb-' + d.id);
      if (el) el.style.width = d.finalScore + '%';
    });
  }, 500);

  // Source reference
  if (criteria.source) {
    document.getElementById('resultSourceRef').style.display  = 'flex';
    document.getElementById('resultSourceLink').href          = criteria.source.url;
    document.getElementById('resultSourceLink').textContent   = criteria.source.label + ' ↗';
  }

  // Improvement tips
  const tips = [...(criteria.improvement_tips || [])];
  tips.push(`You recorded ${S.compressionCount} actions. Consistency score: ${Math.round(consistency)}%.`);
  document.getElementById('tips-list').innerHTML = tips
    .map((t, i) => `<div class="tip-item"><span class="tip-num">0${i + 1}</span><span>${t}</span></div>`)
    .join('');

  showPage('results');
}

/* ── NOTIFICATION TOAST ──────────────────────────────────── */
let notifTimer = null;
function notify(msg) {
  const el = document.getElementById('notif');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
