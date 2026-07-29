/**
 * Reject near-blank generation results (all-white / all-black / near-zero variance).
 * Used after Local/Cloud generate so Job does not succeed on unusable canvases.
 */

export type BlankImageAssessment = {
  blank: boolean;
  reason?: string;
  meanLuma: number;
  stdDev: number;
  width: number;
  height: number;
};

export type AssessBlankImageOptions = {
  /** Mean luma above this with low variance → white blank (0–255). Default 245 */
  whiteMeanMin?: number;
  /** Mean luma below this with low variance → black blank. Default 12 */
  blackMeanMax?: number;
  /** Max std-dev (luma) to treat as flat. Default 14 */
  maxStdDev?: number;
  /**
   * Skip assessment for tiny stub images (dry-run / skipNetwork).
   * Default: skip when either edge < 32.
   */
  minEdgeForCheck?: number;
};

function lumaStdDev(samples: Uint8Array | Uint8ClampedArray): {
  mean: number;
  stdDev: number;
} {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]!;
  const mean = sum / samples.length;
  let varSum = 0;
  for (let i = 0; i < samples.length; i++) {
    const d = samples[i]! - mean;
    varSum += d * d;
  }
  return { mean, stdDev: Math.sqrt(varSum / samples.length) };
}

/**
 * Pure assessment from grayscale samples (testable without sharp).
 */
export function assessBlankFromLumaSamples(
  samples: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options?: AssessBlankImageOptions
): BlankImageAssessment {
  const whiteMeanMin = options?.whiteMeanMin ?? 245;
  const blackMeanMax = options?.blackMeanMax ?? 12;
  const maxStdDev = options?.maxStdDev ?? 14;
  const minEdge = options?.minEdgeForCheck ?? 32;

  if (width < minEdge || height < minEdge) {
    return {
      blank: false,
      meanLuma: 0,
      stdDev: 0,
      width,
      height,
      reason: "skipped_tiny",
    };
  }

  if (samples.length === 0) {
    return {
      blank: true,
      meanLuma: 0,
      stdDev: 0,
      width,
      height,
      reason: "empty_pixels",
    };
  }

  const { mean, stdDev } = lumaStdDev(samples);
  const flat = stdDev <= maxStdDev;

  if (flat && mean >= whiteMeanMin) {
    return {
      blank: true,
      meanLuma: mean,
      stdDev,
      width,
      height,
      reason: "near_white_flat",
    };
  }
  if (flat && mean <= blackMeanMax) {
    return {
      blank: true,
      meanLuma: mean,
      stdDev,
      width,
      height,
      reason: "near_black_flat",
    };
  }

  return {
    blank: false,
    meanLuma: mean,
    stdDev,
    width,
    height,
  };
}

/**
 * Decode image bytes via sharp → downsample → luma samples → blank verdict.
 */
export async function assessBlankImageBuffer(
  bytes: Buffer,
  options?: AssessBlankImageOptions
): Promise<BlankImageAssessment> {
  if (!bytes?.length) {
    return {
      blank: true,
      meanLuma: 0,
      stdDev: 0,
      width: 0,
      height: 0,
      reason: "empty_buffer",
    };
  }

  // Extremely small payloads: decode; stub/dry-run 1×1 PNG is OK to skip.
  if (bytes.length < 200) {
    try {
      const sharp = (await import("sharp")).default;
      const meta = await sharp(bytes).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      if (w < 32 || h < 32) {
        return {
          blank: false,
          meanLuma: 0,
          stdDev: 0,
          width: w,
          height: h,
          reason: "skipped_tiny",
        };
      }
    } catch {
      // fall through to reject
    }
    return {
      blank: true,
      meanLuma: 0,
      stdDev: 0,
      width: 0,
      height: 0,
      reason: "tiny_file",
    };
  }

  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize(64, 64, { fit: "inside" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return assessBlankFromLumaSamples(
    data,
    info.width,
    info.height,
    options
  );
}

export class BlankImageError extends Error {
  readonly assessment: BlankImageAssessment;

  constructor(assessment: BlankImageAssessment) {
    super(
      `blank_image_rejected (${assessment.reason ?? "blank"}; mean=${assessment.meanLuma.toFixed(1)} std=${assessment.stdDev.toFixed(1)})`
    );
    this.name = "BlankImageError";
    this.assessment = assessment;
  }
}

/** Throw BlankImageError when buffer is an unusable flat canvas. */
export async function assertNotBlankImage(
  bytes: Buffer,
  options?: AssessBlankImageOptions
): Promise<BlankImageAssessment> {
  const assessment = await assessBlankImageBuffer(bytes, options);
  if (assessment.blank && assessment.reason !== "skipped_tiny") {
    throw new BlankImageError(assessment);
  }
  return assessment;
}
