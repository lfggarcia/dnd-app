/**
 * IImageServicePort — port for AI portrait/image generation.
 * Infrastructure adapter wraps geminiImageService.ts.
 */
export interface IImageServicePort {
  generatePortrait(
    characterName: string,
    race: string,
    charClass: string,
    seed?: string,
  ): Promise<string>; // returns base64 data URI

  generateExpression(
    basePortrait: string,
    expressionKey: string,
  ): Promise<string>; // returns base64 data URI
}
