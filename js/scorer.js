/* ── HEURISTIC SCORER ────────────────────────────────────────
   Pure scoring functions — no DOM access here.
   Takes pose signals + session data, returns numeric scores.
   ─────────────────────────────────────────────────────────── */

const HeuristicScorer = (() => {
  const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
  const lerp  = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

  function scoreBySignal(dim, ps) {
    const s = ps[dim.pose_signal];
    if (s === undefined || s === null) return 50;

    switch (dim.pose_signal) {
      case 'wrist_center_x':
        return clamp(100 - Math.abs(s - 0.5) * 300);

      case 'wrist_center_y':
        return clamp(100 - Math.abs(s - 0.60) * 280);

      case 'arm_angle':
        if (s >= 165) return 100;
        if (s >= 145) return lerp(60, 100, (s - 145) / 20);
        if (s >= 120) return lerp(20, 60,  (s - 120) / 25);
        return clamp(s - 90);

      case 'elbow_angle':
        if (s >= 160) return 100;
        if (s >= 80 && s <= 100) return 95;
        if (s >= 60 && s < 80)   return lerp(50, 95, (s - 60) / 20);
        if (s > 100 && s < 160)  return lerp(95, 100, (s - 100) / 60);
        return clamp(s * 0.4);

      case 'body_lean':
        return clamp(100 - Math.abs(s - 15) * 3.8);

      case 'shoulder_level':
        return clamp(100 - s * 450);

      case 'hand_height':
        return clamp(100 - Math.abs(s - 0.45) * 260);

      default:
        return 50;
    }
  }

  function scoreRate(bpm, pm) {
    if (!pm || bpm <= 0) return 0;
    const { target_min: mn, target_max: mx } = pm;
    const margin = (mx - mn) * 0.6;
    if (bpm >= mn && bpm <= mx)              return 100;
    if (bpm >= mn - margin && bpm < mn)      return lerp(40, 100, (bpm - (mn - margin)) / margin);
    if (bpm > mx && bpm <= mx + margin)      return lerp(40, 100, ((mx + margin) - bpm) / margin);
    return 15;
  }

  function scoreConsistency(times) {
    if (times.length < 4) return 0;
    const iv = [];
    for (let i = 1; i < times.length; i++) iv.push(times[i] - times[i - 1]);
    const avg      = iv.reduce((a, b) => a + b, 0) / iv.length;
    const variance = iv.reduce((s, v) => s + (v - avg) ** 2, 0) / iv.length;
    return clamp((1 - Math.sqrt(variance) / avg) * 100);
  }

  function scoreAll(criteria, ps, bpm, actionTimes) {
    if (!criteria) return { total: 0, breakdown: [] };

// 🔴 FIX: لا تقيّم إذا لم تُرصد أي حركة حقيقية
  const hasRealActivity = actionTimes && actionTimes.length >= 3;
  
  const breakdown = criteria.dimensions.map(dim => {
    const isRate = dim.id.includes('rate') || dim.id.includes('count');
    
    // إذا لا يوجد نشاط حقيقي، أعطِ صفراً لكل الأبعاد
    if (!hasRealActivity) {
      return {
        ...dim,
        score: 0,
        feedback: dim.bad_feedback
      };
    }
    
    const score = isRate
      ? scoreRate(bpm, criteria.primary_metric)
      : scoreBySignal(dim, ps);
    const r = Math.round(score);
    return {
      ...dim,
      score: r,
      feedback: r >= 75 ? dim.good_feedback : r >= 40 ? dim.warn_feedback : dim.bad_feedback
    };
  });

  return {
    total: Math.round(breakdown.reduce((s, d) => s + d.score * d.weight, 0)),
    breakdown
  };
}

  return { scoreAll, scoreRate, scoreConsistency, scoreBySignal };
})();
