declare module 'word-extractor' {
  export interface ExtractedDocument {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getHeaders(options?: any): string;
    getFooters(options?: any): string;
    getAnnotations(): string;
    getTextboxes(options?: any): string;
  }

  export default class WordExtractor {
    extract(source: Buffer | string): Promise<ExtractedDocument>;
  }
}
