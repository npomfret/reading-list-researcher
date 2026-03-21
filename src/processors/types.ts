export interface UrlInfo {
  url: string;
  title: string;
  dateAdded: Date | null;
}

export interface ProcessorResult {
  report: string;
}

export interface LlmProcessor {
  name: string;
  process(urlInfo: UrlInfo, pageContent: string): Promise<ProcessorResult>;
  generate(prompt: string): Promise<string>;
}
