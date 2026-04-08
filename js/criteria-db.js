/* ── CRITERIA DATABASE ───────────────────────────────────────
   All clinical skill definitions and assessment dimensions.
   To add a new skill, push a new object into the skills array.
   ─────────────────────────────────────────────────────────── */

const CRITERIA_DB = {
  version: "1.0",
  skills: [
    {
      id: "cpr",
      name: "CPR / Chest Compressions",
      emoji: "🫀",
      tag: "Basic Life Support",
      description: "Adult CPR chest compressions per AHA 2020 guidelines.",
      source: {
        label: "AHA Guidelines 2020",
        url: "https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines"
      },
      session_duration: 30,
      primary_metric: {
        label: "Compression Rate",
        unit: "BPM",
        target_min: 100,
        target_max: 120,
        target_display: "100–120 BPM"
      },
      dimensions: [
        {
          id: "hand_position",
          name: "Hand Position",
          weight: 0.25,
          pose_signal: "wrist_center_x",
          target_description: "Heel of hand on center of lower sternum",
          good_feedback: "Good hand position on sternum",
          warn_feedback: "Adjust hands to chest midline",
          bad_feedback: "Move hands to center of chest"
        },
        {
          id: "arm_alignment",
          name: "Arm Alignment",
          weight: 0.25,
          pose_signal: "arm_angle",
          target_description: "Arms fully extended, elbows locked",
          good_feedback: "Arms straight — good force transfer",
          warn_feedback: "Straighten arms for better depth",
          bad_feedback: "Keep arms locked — do not bend elbows"
        },
        {
          id: "compression_rate",
          name: "Compression Rate",
          weight: 0.35,
          pose_signal: "wrist_center_y",
          target_description: "100–120 compressions per minute",
          good_feedback: "Good rhythm — maintain pace",
          warn_feedback: "Adjust rate toward 100–120 BPM",
          bad_feedback: "Rate outside 100–120 BPM target"
        },
        {
          id: "consistency",
          name: "Consistency",
          weight: 0.15,
          pose_signal: "shoulder_level",
          target_description: "Equal interval between every compression",
          good_feedback: "Very consistent rhythm",
          warn_feedback: "Aim for a steady metronome-like pace",
          bad_feedback: "High variability — stabilise your rhythm"
        }
      ],
      improvement_tips: [
        "Practise to the beat of 'Stayin Alive' (~100 BPM) to internalise the correct speed.",
        "Place the heel of your dominant hand on the lower sternum, stack the other hand on top, interlace fingers.",
        "Lock both elbows and position shoulders directly above hands — use body weight, not arm strength.",
        "AHA guideline: 100–120 BPM, 5–6 cm depth, allow full chest recoil between compressions."
      ]
    },

    {
      id: "surgical_scrub",
      name: "Surgical Hand Scrub",
      emoji: "🧼",
      tag: "Aseptic Technique",
      description: "Standardised surgical hand scrub per WHO surgical safety guidelines.",
      source: {
        label: "WHO Surgical Safety Guidelines",
        url: "https://www.who.int/publications/i/item/9789241598552"
      },
      session_duration: 60,
      primary_metric: {
        label: "Scrub Duration",
        unit: "sec",
        target_min: 120,
        target_max: 180,
        target_display: "2–3 minutes"
      },
      dimensions: [
        {
          id: "hand_elevation",
          name: "Hand Elevation",
          weight: 0.30,
          pose_signal: "hand_height",
          target_description: "Hands held higher than elbows throughout",
          good_feedback: "Good hand elevation above elbows",
          warn_feedback: "Raise hands above elbow level",
          bad_feedback: "Hands must remain above elbows always"
        },
        {
          id: "elbow_position",
          name: "Elbow Angle",
          weight: 0.25,
          pose_signal: "elbow_angle",
          target_description: "Elbows bent at ~90°, forearms vertical",
          good_feedback: "Correct elbow angle maintained",
          warn_feedback: "Adjust elbow angle toward 90°",
          bad_feedback: "Elbows should be at roughly 90°"
        },
        {
          id: "body_posture",
          name: "Body Posture",
          weight: 0.25,
          pose_signal: "body_lean",
          target_description: "Upright posture, slight forward lean",
          good_feedback: "Good upright scrub posture",
          warn_feedback: "Stand more upright during scrub",
          bad_feedback: "Maintain upright posture throughout"
        },
        {
          id: "symmetry",
          name: "Bilateral Symmetry",
          weight: 0.20,
          pose_signal: "shoulder_level",
          target_description: "Both hands scrubbed equally",
          good_feedback: "Symmetric bilateral technique",
          warn_feedback: "Ensure both hands scrubbed equally",
          bad_feedback: "Both sides must be scrubbed evenly"
        }
      ],
      improvement_tips: [
        "Keep hands above elbow level at all times — water and contaminants flow downward.",
        "Scrub all surfaces: palm, back of hand, fingers, interdigital spaces, and wrists.",
        "WHO recommends at least 2 minutes of surgical scrub before donning sterile gloves.",
        "Do not touch the sink or any non-sterile surface after scrubbing begins."
      ]
    },

    {
      id: "patient_transfer",
      name: "Patient Transfer",
      emoji: "🛏️",
      tag: "Manual Handling",
      description: "Safe patient transfer and manual handling technique.",
      source: {
        label: "NHS Manual Handling Guidelines",
        url: "https://www.nhs.uk/conditions/social-care-and-support-guide/practical-tips-if-you-care-for-someone/moving-and-handling/"
      },
      session_duration: 30,
      primary_metric: {
        label: "Movement Rate",
        unit: "moves/min",
        target_min: 4,
        target_max: 10,
        target_display: "4–10 moves/min"
      },
      dimensions: [
        {
          id: "back_posture",
          name: "Back Posture",
          weight: 0.35,
          pose_signal: "body_lean",
          target_description: "Straight back, bend at knees not waist",
          good_feedback: "Good back posture maintained",
          warn_feedback: "Keep back straighter — bend at knees",
          bad_feedback: "Avoid bending at the waist — risk of injury"
        },
        {
          id: "shoulder_alignment",
          name: "Shoulder Alignment",
          weight: 0.25,
          pose_signal: "shoulder_level",
          target_description: "Shoulders level and square to patient",
          good_feedback: "Shoulders aligned correctly",
          warn_feedback: "Keep shoulders level and square",
          bad_feedback: "Align shoulders to avoid asymmetric load"
        },
        {
          id: "arm_control",
          name: "Arm Control",
          weight: 0.25,
          pose_signal: "arm_angle",
          target_description: "Controlled arm movement",
          good_feedback: "Smooth and controlled arm movement",
          warn_feedback: "Use more controlled arm movements",
          bad_feedback: "Jerky movements increase injury risk"
        },
        {
          id: "centre_of_gravity",
          name: "Centre of Gravity",
          weight: 0.15,
          pose_signal: "wrist_center_x",
          target_description: "Weight centred, stable base",
          good_feedback: "Stable centre of gravity",
          warn_feedback: "Redistribute weight for better stability",
          bad_feedback: "Unstable — widen stance and centre weight"
        }
      ],
      improvement_tips: [
        "Always bend at the knees and hips, not the waist — keep the spine in neutral alignment.",
        "Establish a wide, stable base of support before initiating any transfer.",
        "Communicate clearly with the patient before and during every movement.",
        "Use assistive equipment (slide sheets, hoists) whenever available rather than manual force."
      ]
    }
  ]
};
