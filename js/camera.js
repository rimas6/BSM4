/* ── CAMERA & POSE ───────────────────────────────────────────
   Handles getUserMedia, MediaPipe Pose initialisation,
   pose result processing, and ghost/skeleton drawing.
   ─────────────────────────────────────────────────────────── */

/* ── CAMERA REQUEST ──────────────────────────────────────── */
async function requestCamera() {
  showCamState('stateRequesting');
  document.getElementById('session-status').textContent = 'Requesting Camera...';
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    });
    const video = document.getElementById('videoEl');
    video.srcObject = S.stream;
    video.style.display = 'block';
    document.getElementById('poseCanvas').style.display = 'block';
    await new Promise(r => { video.onloadedmetadata = r; });
    await video.play();
    hideCamStates();
    document.getElementById('liveOverlay').style.display = 'block';
    document.getElementById('rhythmSection').style.display = 'block';
    document.getElementById('session-status').textContent = 'Loading AI Model...';
    await initPose();
    document.getElementById('session-status').textContent = 'Session Active';
    startTimer();
    S.running = true;
    notify('Session started!');
  } catch (err) {
    showCamState('stateDenied');
    document.getElementById('session-status').textContent = 'Camera Error';
  }
}

/* ── CAM STATE HELPERS ───────────────────────────────────── */
function showCamState(id) {
  ['stateIdle', 'stateRequesting', 'stateDenied'].forEach(s => {
    document.getElementById(s).style.display = (s === id) ? 'flex' : 'none';
  });
}

function hideCamStates() {
  ['stateIdle', 'stateRequesting', 'stateDenied'].forEach(s => {
    document.getElementById(s).style.display = 'none';
  });
}

/* ── MEDIAPIPE POSE INIT ─────────────────────────────────── */
async function initPose() {
  return new Promise(resolve => {
    const t = setTimeout(() => { startSimMode(); resolve(); }, 8000);

    if (typeof Pose === 'undefined') {
      clearTimeout(t);
      startSimMode();
      resolve();
      return;
    }

    const p = new Pose({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${f}`
    });
    p.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    p.onResults(onPoseResults);
    S.pose = p;

    if (typeof Camera !== 'undefined') {
      const cam = new Camera(document.getElementById('videoEl'), {
        onFrame: async () => {
          if (S.pose && S.running) await S.pose.send({ image: document.getElementById('videoEl') });
        },
        width: 1280,
        height: 720
      });
      S.camera = cam;
      cam.start()
        .then(() => { clearTimeout(t); resolve(); })
        .catch(() => { clearTimeout(t); startSimMode(); resolve(); });
    } else {
      clearTimeout(t);
      startSimMode();
      resolve();
    }
  });
}

/* ── POSE RESULTS (real camera) ──────────────────────────── */
function onPoseResults(results) {
  if (!S.running) return;
  const canvas = document.getElementById('poseCanvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = results.image.width;
  canvas.height = results.image.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Ghost: show when no action yet, hide after first action
  if (S.compressionCount === 0) drawGhostPose(ctx, canvas.width, canvas.height);

  if (!results.poseLandmarks || !results.poseLandmarks.length) {
    setPoseStatus(false);
    return;
  }

  setPoseStatus(true);
  S.frameCount++;
  const lm = results.poseLandmarks;

  if (typeof drawConnectors !== 'undefined') {
    const userColor = S.compressionCount > 0
      ? 'rgba(5,150,105,0.85)'
      : 'rgba(59,130,246,0.7)';
    drawConnectors(ctx, lm, POSE_CONNECTIONS, { color: userColor, lineWidth: 3 });
    drawLandmarks(ctx, lm, { color: 'rgba(255,255,255,0.9)', fillColor: userColor, lineWidth: 2, radius: 4 });
  }

  const angle = (a, b, c) => {
    const ab = [b.x - a.x, b.y - a.y];
    const cb = [b.x - c.x, b.y - c.y];
    const d  = ab[0] * cb[0] + ab[1] * cb[1];
    const m  = Math.sqrt(ab[0] ** 2 + ab[1] ** 2) * Math.sqrt(cb[0] ** 2 + cb[1] ** 2);
    return m === 0 ? 0 : Math.acos(Math.min(1, Math.max(-1, d / m))) * 180 / Math.PI;
  };

  const ps = {
    wrist_center_x:  (lm[15].x + lm[16].x) / 2,
    wrist_center_y:  (lm[15].y + lm[16].y) / 2,
    arm_angle:       (angle(lm[11], lm[13], lm[15]) + angle(lm[12], lm[14], lm[16])) / 2,
    elbow_angle:     (angle(lm[11], lm[13], lm[15]) + angle(lm[12], lm[14], lm[16])) / 2,
    body_lean:        Math.abs(((lm[11].x + lm[12].x) / 2 - (lm[23].x + lm[24].x) / 2)) * 90,
    shoulder_level:   Math.abs(lm[11].y - lm[12].y),
    hand_height:      Math.abs((lm[15].y + lm[16].y) / 2 - (lm[11].y + lm[12].y) / 2)
  };

  S.latestPoseSignals = ps;
  const { breakdown } = HeuristicScorer.scoreAll(ACTIVE_CRITERIA, ps, S.currentBPM, S.compressionTimes);
  breakdown.forEach(d => {
    if (!S.dimensionScoreHistory[d.id]) S.dimensionScoreHistory[d.id] = [];
    S.dimensionScoreHistory[d.id].push(d.score);
  });

  processWristMovement((lm[15].y + lm[16].y) / 2, Date.now());
  updateLiveScores();
  generateFeedback(breakdown);
}

/* ── GHOST OVERLAY ───────────────────────────────────────────
   Draws a dashed "ideal position" skeleton over the canvas.
   Called when compressionCount === 0 (before first action).
   Hides automatically after first detected action.
   ─────────────────────────────────────────────────────────── */
function drawGhostPose(ctx, W, H) {
  const ghost = {
    lSho: [0.37, 0.38], rSho: [0.63, 0.38],
    lElb: [0.36, 0.55], rElb: [0.64, 0.55],
    lWri: [0.45, 0.70], rWri: [0.55, 0.70]
  };
  const p = k => [ghost[k][0] * W, ghost[k][1] * H];

  ctx.save();

  // Pulsing opacity effect
  const pulse = 0.82 + 0.15 * Math.sin(Date.now() / 1800);

  // Skeleton lines — dashed white-blue
  ctx.strokeStyle = `rgba(163,230,53,${pulse})`;
  ctx.lineWidth   = 4.5;
  ctx.setLineDash([10, 7]);
  ctx.shadowColor = 'rgba(132,204,22,0.8)';
  ctx.shadowBlur  = 18;
  ctx.lineCap     = 'round';

  // Draw arm chain: lWri → lElb → lSho → rSho → rElb → rWri
  ctx.beginPath();
  ctx.moveTo(...p('lWri'));
  ctx.lineTo(...p('lElb'));
  ctx.lineTo(...p('lSho'));
  ctx.lineTo(...p('rSho'));
  ctx.lineTo(...p('rElb'));
  ctx.lineTo(...p('rWri'));
  ctx.stroke();

  // Target zone circle between wrists
  const mx = (p('lWri')[0] + p('rWri')[0]) / 2;
  const my = (p('lWri')[1] + p('rWri')[1]) / 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(mx, my, W * 0.055, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(132,204,22,${pulse * 0.22})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(163,230,53,${pulse})`;
  ctx.stroke();

  // Dots at key joints
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ['lSho', 'rSho', 'lElb', 'rElb', 'lWri', 'rWri'].forEach(k => {
    const isWrist = k.includes('Wri');
    ctx.beginPath();
    ctx.arc(...p(k), isWrist ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isWrist
      ? `rgba(250,204,21,${pulse})`
      : `rgba(163,230,53,${pulse})`;
    ctx.fill();
  });

  // Hint label
  ctx.setLineDash([]);
  ctx.shadowBlur  = 0;
  ctx.font        = "bold 13px 'DM Sans', sans-serif";
  ctx.fillStyle   = `rgba(217,249,157,${pulse})`;
  ctx.textAlign   = 'center';
  ctx.fillText('Align with guide — then begin', W / 2, H * 0.18);
  ctx.restore();
}

/* ── SIMULATION SKELETON ─────────────────────────────────── */
function drawSimSkeleton() {
  const canvas = document.getElementById('poseCanvas');
  const video  = document.getElementById('videoEl');
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const W = canvas.width, H = canvas.height;
  const b = Math.sin(Date.now() / 290) * 0.028;

  if (S.compressionCount === 0) drawGhostPose(ctx, W, H);

  const pts = {
    nose:  [.50,.10], lSho:[.37,.28], rSho:[.63,.28],
    lElb:  [.34,.44], rElb:[.66,.44],
    lWri:  [.43,.56+b], rWri:[.57,.56+b],
    lHip:  [.42,.63], rHip:[.58,.63],
    lKne:  [.41,.78], rKne:[.59,.78],
    lAnk:  [.42,.92], rAnk:[.58,.92]
  };
  const p = k => [pts[k][0] * W, pts[k][1] * H];
  const conns = [
    ['lSho','rSho'],['lSho','lElb'],['lElb','lWri'],['rSho','rElb'],['rElb','rWri'],
    ['lSho','lHip'],['rSho','rHip'],['lHip','rHip'],
    ['lHip','lKne'],['lKne','lAnk'],['rHip','rKne'],['rKne','rAnk']
  ];

  ctx.lineWidth = 2.5;
  ctx.lineCap   = 'round';
  conns.forEach(([a, bg]) => {
    const isArm = a.includes('Elb') || a.includes('Wri') || bg.includes('Elb') || bg.includes('Wri');
    ctx.strokeStyle = isArm ? 'rgba(59,130,246,0.85)' : 'rgba(59,130,246,0.35)';
    ctx.beginPath();
    ctx.moveTo(...p(a));
    ctx.lineTo(...p(bg));
    ctx.stroke();
  });

  Object.keys(pts).forEach(k => {
    const iw = k.includes('Wri');
    ctx.fillStyle = iw ? '#d97706' : 'rgba(59,130,246,0.9)';
    ctx.beginPath();
    ctx.arc(...p(k), iw ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    if (iw) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
  });
}

/* ── POSE STATUS ─────────────────────────────────────────── */
function setPoseStatus(on) {
  S.poseDetected = on;
  document.getElementById('poseDot').classList.toggle('on', on);
  document.getElementById('poseLabel').textContent  = on ? 'Pose detected' : 'Move into frame';
  document.getElementById('poseLabel').style.color  = on ? 'var(--good)' : 'var(--warn)';
  const txt = document.getElementById('poseStatusTxt');
  if (txt) {
    txt.textContent = on ? 'DETECTED' : 'SEARCHING';
    txt.style.color = on ? 'var(--good)' : 'var(--warn)';
  }
}
