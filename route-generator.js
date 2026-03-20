/* Route Generator Service
 *
 * Generates closed-loop cycling routes that match RideSync's route preset shape:
 * - courseSegments: [{ startDistance, endDistance, grade }]
 * - elevationProfile: [{ distanceFromStartM, elevationM, gradientPct }]
 *
 * The generator enforces believable grades, smooth transitions, and a loop profile
 * where start and end elevation align.
 */
(function attachRouteGenerator(globalScope) {
  const ABSOLUTE_MAX_GRADE = 12;
  const DEFAULT_SAMPLE_STEP_METERS = 100;

  const HILLINESS_PRESETS = Object.freeze({
    flat: Object.freeze({
      key: "flat",
      label: "Flat",
      segmentLengthMinM: 320,
      segmentLengthMaxM: 920,
      amplitude: 1.8,
      bias: 0.45,
      positiveBias: 0.72,
      smoothPasses: 4,
      transitionLimit: 1.0,
      mostlyRangeMin: -0.5,
      mostlyRangeMax: 2.2,
      mostlyShareMin: 0.72,
      preferredMin: 0,
      preferredMax: 2,
      supportMin: -2.5,
      supportMax: 4.5,
      targetAscentPerKmMin: 6,
      targetAscentPerKmMax: 18,
    }),
    rolling: Object.freeze({
      key: "rolling",
      label: "Rolling",
      segmentLengthMinM: 260,
      segmentLengthMaxM: 760,
      amplitude: 3.7,
      bias: 0.12,
      positiveBias: 0.58,
      smoothPasses: 3,
      transitionLimit: 1.5,
      mostlyRangeMin: -4,
      mostlyRangeMax: 4,
      mostlyShareMin: 0.72,
      preferredMin: -4,
      preferredMax: 4,
      supportMin: -5.8,
      supportMax: 5.8,
      targetAscentPerKmMin: 18,
      targetAscentPerKmMax: 44,
    }),
    hilly: Object.freeze({
      key: "hilly",
      label: "Hilly",
      segmentLengthMinM: 240,
      segmentLengthMaxM: 700,
      amplitude: 5.2,
      bias: 0.1,
      positiveBias: 0.54,
      smoothPasses: 2,
      transitionLimit: 1.9,
      mostlyRangeMin: -6,
      mostlyRangeMax: 6,
      mostlyShareMin: 0.72,
      preferredMin: -6,
      preferredMax: 6,
      supportMin: -8,
      supportMax: 8,
      targetAscentPerKmMin: 32,
      targetAscentPerKmMax: 72,
    }),
    climbing: Object.freeze({
      key: "climbing",
      label: "Climbing",
      segmentLengthMinM: 280,
      segmentLengthMaxM: 980,
      amplitude: 8.6,
      bias: 0.2,
      positiveBias: 0.6,
      smoothPasses: 2,
      transitionLimit: 2.8,
      mostlyRangeMin: -8,
      mostlyRangeMax: 10,
      mostlyShareMin: 0.66,
      preferredMin: -8,
      preferredMax: 10,
      supportMin: -10,
      supportMax: 12,
      targetAscentPerKmMin: 52,
      targetAscentPerKmMax: 130,
    }),
  });

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function createRng(seedValue) {
    let seed = (Number(seedValue) || Date.now()) >>> 0;
    return function next() {
      seed += 0x6d2b79f5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomRange(min, max, rng) {
    return min + (max - min) * rng();
  }

  function normalizeHilliness(input) {
    const key = String(input || "rolling").trim().toLowerCase();
    if (HILLINESS_PRESETS[key]) return key;
    return "rolling";
  }

  function resolvePreset(input) {
    return HILLINESS_PRESETS[normalizeHilliness(input)];
  }

  function normalizeDistanceKm(distanceKmInput) {
    const parsed = Number(distanceKmInput);
    if (!Number.isFinite(parsed)) return 20;
    return clamp(parsed, 2, 300);
  }

  function chooseSegmentCount(totalDistanceMeters, minSegmentMeters, maxSegmentMeters) {
    const minCount = Math.max(4, Math.ceil(totalDistanceMeters / maxSegmentMeters));
    const maxCount = Math.max(minCount, Math.floor(totalDistanceMeters / minSegmentMeters));
    const averageLength = (minSegmentMeters + maxSegmentMeters) / 2;
    const targetCount = Math.round(totalDistanceMeters / Math.max(averageLength, 1));
    return clamp(targetCount, minCount, maxCount);
  }

  function constrainLengths(lengthsInput, totalDistanceMeters, minSegmentMeters, maxSegmentMeters, rng) {
    const lengths = lengthsInput.slice();
    for (let pass = 0; pass < 10; pass += 1) {
      for (let i = 0; i < lengths.length; i += 1) {
        lengths[i] = clamp(lengths[i], minSegmentMeters, maxSegmentMeters);
      }
      const currentTotal = sum(lengths);
      const delta = totalDistanceMeters - currentTotal;
      if (Math.abs(delta) < 1e-6) break;

      const adjustable = [];
      for (let i = 0; i < lengths.length; i += 1) {
        const room =
          delta > 0 ? Math.max(0, maxSegmentMeters - lengths[i]) : Math.max(0, lengths[i] - minSegmentMeters);
        if (room > 1e-6) adjustable.push({ index: i, room });
      }
      if (adjustable.length === 0) break;

      const roomTotal = adjustable.reduce((total, item) => total + item.room, 0);
      if (roomTotal <= 1e-6) break;
      adjustable.forEach((item) => {
        const jitter = 0.85 + rng() * 0.3;
        const amount = (delta * (item.room / roomTotal)) * jitter;
        lengths[item.index] += amount;
      });
    }
    return lengths;
  }

  function buildSegmentLengths(totalDistanceMeters, preset, rng) {
    const count = chooseSegmentCount(totalDistanceMeters, preset.segmentLengthMinM, preset.segmentLengthMaxM);
    const weights = Array.from({ length: count }, () => randomRange(0.65, 1.35, rng));
    const weightTotal = sum(weights) || 1;
    const unconstrained = weights.map((weight) => (weight / weightTotal) * totalDistanceMeters);
    return constrainLengths(
      unconstrained,
      totalDistanceMeters,
      preset.segmentLengthMinM,
      preset.segmentLengthMaxM,
      rng,
    );
  }

  function smoothGrades(gradesInput, passes) {
    let grades = gradesInput.slice();
    for (let pass = 0; pass < passes; pass += 1) {
      const next = grades.slice();
      for (let i = 0; i < grades.length; i += 1) {
        const left = grades[Math.max(0, i - 1)];
        const center = grades[i];
        const right = grades[Math.min(grades.length - 1, i + 1)];
        next[i] = left * 0.25 + center * 0.5 + right * 0.25;
      }
      grades = next;
    }
    return grades;
  }

  function limitTransitions(gradesInput, maxStep) {
    const grades = gradesInput.slice();
    for (let i = 1; i < grades.length; i += 1) {
      const delta = grades[i] - grades[i - 1];
      if (delta > maxStep) grades[i] = grades[i - 1] + maxStep;
      if (delta < -maxStep) grades[i] = grades[i - 1] - maxStep;
    }
    for (let i = grades.length - 2; i >= 0; i -= 1) {
      const delta = grades[i] - grades[i + 1];
      if (delta > maxStep) grades[i] = grades[i + 1] + maxStep;
      if (delta < -maxStep) grades[i] = grades[i + 1] - maxStep;
    }
    return grades;
  }

  function calculateNetElevationDeltaMeters(segmentLengths, grades) {
    let deltaMeters = 0;
    for (let i = 0; i < segmentLengths.length; i += 1) {
      deltaMeters += segmentLengths[i] * (grades[i] / 100);
    }
    return deltaMeters;
  }

  function rebalanceClosedLoop(segmentLengths, gradesInput, maxAbsGrade) {
    const grades = gradesInput.slice();
    const totalDistanceMeters = Math.max(1, sum(segmentLengths));

    for (let iteration = 0; iteration < 14; iteration += 1) {
      const deltaMeters = calculateNetElevationDeltaMeters(segmentLengths, grades);
      if (Math.abs(deltaMeters) <= 0.15) break;
      const globalGradeCorrection = (deltaMeters * 100) / totalDistanceMeters;
      for (let i = 0; i < grades.length; i += 1) {
        grades[i] = clamp(grades[i] - globalGradeCorrection, -maxAbsGrade, maxAbsGrade);
      }
    }

    for (let iteration = 0; iteration < 18; iteration += 1) {
      const deltaMeters = calculateNetElevationDeltaMeters(segmentLengths, grades);
      if (Math.abs(deltaMeters) <= 0.05) break;
      const needMoreDescending = deltaMeters > 0;
      let weightedDistance = 0;
      const eligible = [];
      for (let i = 0; i < grades.length; i += 1) {
        const hasRoom = needMoreDescending ? grades[i] > -maxAbsGrade + 1e-6 : grades[i] < maxAbsGrade - 1e-6;
        if (!hasRoom) continue;
        eligible.push(i);
        weightedDistance += segmentLengths[i];
      }
      if (weightedDistance <= 1e-6) break;
      const gradeAdjustment = (Math.abs(deltaMeters) * 100) / weightedDistance;
      for (const index of eligible) {
        grades[index] = clamp(
          grades[index] + (needMoreDescending ? -gradeAdjustment : gradeAdjustment),
          -maxAbsGrade,
          maxAbsGrade,
        );
      }
    }

    return grades;
  }

  function generateGradesGeneral(segmentLengths, preset, rng) {
    const count = segmentLengths.length;
    const phaseA = randomRange(0, Math.PI * 2, rng);
    const phaseB = randomRange(0, Math.PI * 2, rng);
    const freqA = randomRange(0.8, 1.8, rng);
    const freqB = randomRange(1.7, 3.6, rng);
    const grades = [];

    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const waveA = Math.sin((t * freqA + phaseA) * Math.PI * 2) * 0.62;
      const waveB = Math.sin((t * freqB + phaseB) * Math.PI * 2) * 0.38;
      const noise = randomRange(-1, 1, rng) * preset.amplitude * 0.26;
      let grade = (waveA + waveB) * preset.amplitude + noise + preset.bias;
      if (grade < 0 && rng() < preset.positiveBias) {
        grade *= randomRange(0.35, 0.72, rng);
      }
      grades.push(grade);
    }

    return grades;
  }

  function generateGradesClimbing(segmentLengths, preset, rng) {
    const count = segmentLengths.length;
    const grades = [];
    let rampUsed = false;

    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      let grade;
      if (t < 0.4) {
        grade = randomRange(6.0, 9.8, rng) + Math.sin(t * Math.PI * 6) * 0.9;
        if (!rampUsed && t > 0.12 && rng() < 0.08) {
          grade = randomRange(10.6, 12.0, rng);
          rampUsed = true;
        }
      } else if (t < 0.58) {
        const mix = (t - 0.4) / 0.18;
        grade = lerp(8.2, -3.2, mix) + randomRange(-1.1, 1.1, rng);
      } else if (t < 0.93) {
        grade = randomRange(-7.8, -3.4, rng) + Math.sin(t * Math.PI * 5) * 0.9;
      } else {
        grade = randomRange(-1.6, 1.8, rng);
      }
      grades.push(grade);
    }

    const smoothed = smoothGrades(grades, preset.smoothPasses);
    return smoothed.map((grade) => clamp(grade, preset.supportMin, preset.supportMax));
  }

  function finalizeGrades(segmentLengths, rawGrades, preset) {
    const limitedSupport = rawGrades.map((grade) => clamp(grade, preset.supportMin, preset.supportMax));
    const smoothed = smoothGrades(limitedSupport, preset.smoothPasses);
    const transitionLimited = limitTransitions(smoothed, preset.transitionLimit);
    const hardLimited = transitionLimited.map((grade) => clamp(grade, -ABSOLUTE_MAX_GRADE, ABSOLUTE_MAX_GRADE));
    const closedLoop = rebalanceClosedLoop(segmentLengths, hardLimited, ABSOLUTE_MAX_GRADE);
    const transitionLimitedAgain = limitTransitions(closedLoop, preset.transitionLimit + 0.35);
    const closedLoopAgain = rebalanceClosedLoop(segmentLengths, transitionLimitedAgain, ABSOLUTE_MAX_GRADE);
    return closedLoopAgain.map((grade) => Number(clamp(grade, -ABSOLUTE_MAX_GRADE, ABSOLUTE_MAX_GRADE).toFixed(2)));
  }

  function buildSegments(segmentLengths, grades, totalDistanceMeters) {
    const segments = [];
    let cursorMeters = 0;
    for (let i = 0; i < segmentLengths.length; i += 1) {
      const startDistance = i === 0 ? 0 : cursorMeters;
      let endDistance =
        i === segmentLengths.length - 1
          ? totalDistanceMeters
          : Math.round(cursorMeters + Math.max(1, segmentLengths[i]));
      if (endDistance <= startDistance) endDistance = startDistance + 1;
      segments.push({
        startDistance,
        endDistance,
        grade: grades[i],
      });
      cursorMeters = endDistance;
    }
    if (segments.length > 0) {
      segments[segments.length - 1].endDistance = totalDistanceMeters;
    }
    return segments;
  }

  function getElevationAtDistanceFromSegments(segments, startElevationMeters, distanceMeters) {
    if (!Array.isArray(segments) || segments.length === 0) return Number(startElevationMeters) || 0;
    const totalDistance = segments[segments.length - 1].endDistance || 0;
    const targetDistance = clamp(Number(distanceMeters) || 0, 0, totalDistance);
    let elevation = Number(startElevationMeters) || 0;

    for (const segment of segments) {
      const start = Number(segment.startDistance) || 0;
      const end = Number(segment.endDistance) || start;
      if (targetDistance <= start) break;
      const covered = Math.min(targetDistance, end) - start;
      if (covered > 0) {
        elevation += covered * ((Number(segment.grade) || 0) / 100);
      }
      if (targetDistance <= end) break;
    }

    return elevation;
  }

  function getGradientFromSegmentsAtDistance(segments, distanceMeters) {
    if (!Array.isArray(segments) || segments.length === 0) return 0;
    const totalDistance = segments[segments.length - 1].endDistance || 0;
    const targetDistance = clamp(Number(distanceMeters) || 0, 0, totalDistance);
    const match =
      segments.find((segment) => targetDistance >= segment.startDistance && targetDistance < segment.endDistance) ||
      segments[segments.length - 1];
    return Number(match?.grade) || 0;
  }

  function buildElevationProfile(segments, startElevationMeters, sampleStepMeters) {
    if (!Array.isArray(segments) || segments.length === 0) return [];
    const totalDistance = segments[segments.length - 1].endDistance || 0;
    const step = Math.max(50, Number(sampleStepMeters) || DEFAULT_SAMPLE_STEP_METERS);
    const points = [];
    for (let distance = 0; distance <= totalDistance; distance += step) {
      points.push({
        distanceFromStartM: distance,
        elevationM: getElevationAtDistanceFromSegments(segments, startElevationMeters, distance),
        gradientPct: getGradientFromSegmentsAtDistance(segments, distance),
      });
    }
    if (points.length === 0 || points[points.length - 1].distanceFromStartM !== totalDistance) {
      points.push({
        distanceFromStartM: totalDistance,
        elevationM: getElevationAtDistanceFromSegments(segments, startElevationMeters, totalDistance),
        gradientPct: getGradientFromSegmentsAtDistance(segments, totalDistance),
      });
    }
    return points;
  }

  function computeMetrics(routePreset) {
    const segments = Array.isArray(routePreset?.courseSegments) ? routePreset.courseSegments : [];
    const startElevation = Number(routePreset?.startElevationM) || 0;
    let elevation = startElevation;
    let summit = elevation;
    let totalAscentM = 0;
    let totalDescentM = 0;
    let maxGradeAbs = 0;
    let weightedAbsoluteGrade = 0;
    let totalDistance = 0;
    let mostlyDistance = 0;
    let climbingWindowDistance = 0;
    let climbingRampDistance = 0;

    const preset = resolvePreset(routePreset?.hillinessPreset);
    for (const segment of segments) {
      const start = Number(segment.startDistance) || 0;
      const end = Number(segment.endDistance) || start;
      const distance = Math.max(0, end - start);
      const grade = Number(segment.grade) || 0;
      const delta = distance * (grade / 100);
      if (delta > 0) {
        totalAscentM += delta;
      } else {
        totalDescentM += -delta;
      }
      elevation += delta;
      summit = Math.max(summit, elevation);
      maxGradeAbs = Math.max(maxGradeAbs, Math.abs(grade));
      weightedAbsoluteGrade += Math.abs(grade) * distance;
      totalDistance += distance;

      if (grade >= preset.mostlyRangeMin && grade <= preset.mostlyRangeMax) {
        mostlyDistance += distance;
      }
      if (grade >= 6 && grade <= 10) climbingWindowDistance += distance;
      if (grade > 10) climbingRampDistance += distance;
    }

    const endElevation = elevation;
    return {
      totalDistanceMeters: totalDistance,
      distanceKm: totalDistance / 1000,
      totalAscentM,
      totalDescentM,
      maxGradeAbs,
      summitElevationM: summit,
      endElevationM: endElevation,
      endDeltaM: endElevation - startElevation,
      mostlyShare: totalDistance > 0 ? mostlyDistance / totalDistance : 0,
      climbingWindowShare: totalDistance > 0 ? climbingWindowDistance / totalDistance : 0,
      climbingRampShare: totalDistance > 0 ? climbingRampDistance / totalDistance : 0,
      avgGradientPct: totalDistance > 0 ? weightedAbsoluteGrade / totalDistance : 0,
    };
  }

  function computeValidationScore(metrics, preset, targetDistanceKm) {
    const distancePenalty = Math.abs(metrics.distanceKm - targetDistanceKm) * 120;
    const closurePenalty = Math.abs(metrics.endDeltaM) * 40;
    const balancePenalty = Math.abs(metrics.totalAscentM - metrics.totalDescentM) * 4;
    const gradePenalty = Math.max(0, metrics.maxGradeAbs - ABSOLUTE_MAX_GRADE) * 1000;
    const mostlyPenalty = Math.max(0, preset.mostlyShareMin - metrics.mostlyShare) * 420;
    return distancePenalty + closurePenalty + balancePenalty + gradePenalty + mostlyPenalty;
  }

  function validateRoutePreset(routePreset, options = {}) {
    const preset = resolvePreset(options.hillinessPreset || routePreset?.hillinessPreset);
    const targetDistanceKm = normalizeDistanceKm(options.distanceKm || routePreset?.distanceKm || 20);
    const metrics = computeMetrics(routePreset);
    const errors = [];
    const warnings = [];

    if (!Array.isArray(routePreset?.courseSegments) || routePreset.courseSegments.length < 4) {
      errors.push("Route must contain multiple segments.");
    }
    if (Math.abs(metrics.distanceKm - targetDistanceKm) > 0.01) {
      errors.push("Route distance does not match target distance.");
    }
    if (Math.abs(metrics.endDeltaM) > 0.5) {
      errors.push("End altitude must match start altitude.");
    }
    if (metrics.maxGradeAbs > ABSOLUTE_MAX_GRADE + 1e-6) {
      errors.push("Grade limit exceeded (+/-12%).");
    }
    const ascentDescentGap = Math.abs(metrics.totalAscentM - metrics.totalDescentM);
    const maxAllowedGap = Math.max(8, Math.max(metrics.totalAscentM, metrics.totalDescentM) * 0.08);
    if (ascentDescentGap > maxAllowedGap) {
      errors.push("Total ascent and descent are not balanced.");
    }
    if (metrics.mostlyShare < preset.mostlyShareMin) {
      errors.push(`Terrain does not match ${preset.label.toLowerCase()} preset strongly enough.`);
    }

    const ascentPerKm = metrics.distanceKm > 0 ? metrics.totalAscentM / metrics.distanceKm : 0;
    if (ascentPerKm < preset.targetAscentPerKmMin || ascentPerKm > preset.targetAscentPerKmMax) {
      warnings.push("Ascent density is outside the preferred range for this hilliness preset.");
    }

    if (preset.key === "climbing") {
      if (metrics.climbingWindowShare < 0.22) {
        errors.push("Climbing preset needs more sustained 6%-10% climbing sections.");
      }
      if (metrics.climbingRampShare > 0.14) {
        errors.push("Climbing preset has too many >10% ramps.");
      }
    }

    const score = computeValidationScore(metrics, preset, targetDistanceKm) + errors.length * 2000;
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metrics,
      score,
    };
  }

  function generateAttempt(totalDistanceMeters, preset, rng) {
    const segmentLengths = buildSegmentLengths(totalDistanceMeters, preset, rng);
    const rawGrades =
      preset.key === "climbing"
        ? generateGradesClimbing(segmentLengths, preset, rng)
        : generateGradesGeneral(segmentLengths, preset, rng);
    const grades = finalizeGrades(segmentLengths, rawGrades, preset);
    return buildSegments(segmentLengths, grades, totalDistanceMeters);
  }

  function generateRoutePreset(options = {}) {
    const hilliness = normalizeHilliness(options.hillinessPreset || options.hilliness || "rolling");
    const preset = resolvePreset(hilliness);
    const distanceKm = normalizeDistanceKm(options.distanceKm);
    const totalDistanceMeters = Math.round(distanceKm * 1000);
    const startElevationM = Number.isFinite(Number(options.startElevationM)) ? Number(options.startElevationM) : 0;
    const sampleStepMeters = Math.max(50, Number(options.sampleStepMeters) || DEFAULT_SAMPLE_STEP_METERS);
    const maxAttempts = clamp(Math.round(Number(options.maxAttempts) || 40), 6, 120);
    const baseSeed = Number.isFinite(Number(options.seed))
      ? Number(options.seed)
      : Date.now() + Math.floor(Math.random() * 1000000);

    let bestCandidate = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const rng = createRng(baseSeed + attempt * 9973);
      const courseSegments = generateAttempt(totalDistanceMeters, preset, rng);
      const elevationProfile = buildElevationProfile(courseSegments, startElevationM, sampleStepMeters);
      const routePreset = {
        id: options.id || "generated-route",
        name: options.name || "Generated Route",
        country: options.country || "Virtual",
        distanceKm,
        elevationGainM: 0,
        startElevationM,
        summitElevationM: startElevationM,
        avgGradientPct: 0,
        maxGradientPct: 0,
        totalDistanceMeters,
        courseSegments,
        elevationProfile,
        hillinessPreset: hilliness,
        generatedAt: Date.now(),
      };

      const validation = validateRoutePreset(routePreset, { distanceKm, hillinessPreset: hilliness });
      const metrics = validation.metrics;
      routePreset.elevationGainM = Math.round(metrics.totalAscentM);
      routePreset.totalDescentM = Math.round(metrics.totalDescentM);
      routePreset.summitElevationM = Number(metrics.summitElevationM.toFixed(1));
      routePreset.avgGradientPct = Number(metrics.avgGradientPct.toFixed(1));
      routePreset.maxGradientPct = Number(metrics.maxGradeAbs.toFixed(1));

      const candidate = {
        routePreset,
        validation,
        attempts: attempt + 1,
      };

      if (!bestCandidate || validation.score < bestCandidate.validation.score) {
        bestCandidate = candidate;
      }
      if (validation.valid) return candidate;
    }

    return bestCandidate;
  }

  function runValidationSuite(options = {}) {
    const attemptsPerPreset = clamp(Math.round(Number(options.attemptsPerPreset) || 8), 1, 100);
    const distanceKm = normalizeDistanceKm(options.distanceKm || 20);
    const hillinessList = Array.isArray(options.hillinessPresets) && options.hillinessPresets.length > 0
      ? options.hillinessPresets.map((key) => normalizeHilliness(key))
      : Object.keys(HILLINESS_PRESETS);
    const results = [];

    hillinessList.forEach((hillinessPreset) => {
      for (let attempt = 0; attempt < attemptsPerPreset; attempt += 1) {
        const candidate = generateRoutePreset({
          distanceKm,
          hillinessPreset,
          seed: (Number(options.seed) || Date.now()) + attempt * 101 + hillinessPreset.length,
          id: "generated-route-test",
          name: "Generated Route Test",
          country: "Virtual",
        });
        results.push({
          hillinessPreset,
          valid: !!candidate?.validation?.valid,
          errors: candidate?.validation?.errors || [],
          score: Number(candidate?.validation?.score) || 0,
        });
      }
    });

    const total = results.length;
    const passed = results.filter((entry) => entry.valid).length;
    return {
      total,
      passed,
      failed: total - passed,
      passRate: total > 0 ? passed / total : 0,
      results,
    };
  }

  globalScope.RouteGeneratorService = Object.freeze({
    ABSOLUTE_MAX_GRADE,
    HILLINESS_PRESETS,
    generateRoutePreset,
    validateRoutePreset,
    runValidationSuite,
  });
})(typeof window !== "undefined" ? window : globalThis);
