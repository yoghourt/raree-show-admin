export type BootstrapInput = {
  title: string;
  description: string;
};

export type GeneratedCharacter = {
  name: string;
  house: string;
  description: string;
  signatureQuote: string | null;
};

export type GeneratedLocation = {
  name: string;
  region: string;
  description: string;
};

export type GeneratedScene = {
  title: string;
  chapter_number: number;
  chapter_title: string | null;
  summary: string;
  /** Zero-based index into the locations[] array returned by the provider. */
  locationIndex: number;
  /** Zero-based indices into the characters[] array returned by the provider. */
  characterIndices: number[];
  /** Caption for story_images_v2[0]. url will be set to "" by the server. */
  imageCaption: string;
};

export type BootstrapGenerationResult = {
  characters: GeneratedCharacter[];
  locations: GeneratedLocation[];
  scenes: GeneratedScene[];
};

export interface BootstrapProvider {
  generate(input: BootstrapInput): Promise<BootstrapGenerationResult>;
}
