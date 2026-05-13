import { pipeline } from "@huggingface/transformers";

const MODEL_ID = "Xenova/bge-small-zh-v1.5";
export const EMBED_DIM = 512;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", MODEL_ID, {
      dtype: "fp32",
    });
  }
  return extractor;
}

/**
 * Embed a single text string using bge-small-zh-v1.5.
 * Returns a 512-dimensional normalized float vector.
 * Downloads the model (~24MB) on first call.
 */
export async function embed(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const result = await ext(text, { pooling: "mean", normalize: true });
  return Array.from(result.data as Float32Array).slice(0, EMBED_DIM);
}
