import {LogEvent, LogEventLevel} from "./logEvent";
import {Sink} from "./sink";
import * as fsp from "fs/promises";
import * as fs from "fs";

export enum FileSize {
  ONE_KB = 1024,
  ONE_MB = FileSize.ONE_KB * 1024,
  ONE_GB = FileSize.ONE_MB * 1024,
}

export interface FileSinkOptions {
  fileName?: string;
  outputDir?: string;
  logEventLevel?: LogEventLevel;
  maxFileSize?: number;
}

class FileSink implements Sink {
  name: string;
  newFile: boolean;
  readonly level: LogEventLevel;
  readonly outputDir: string;
  readonly maxFileSize: number;
  readonly content: string[];

  constructor({ fileName, outputDir, logEventLevel, maxFileSize }: FileSinkOptions) {
    this.name = fileName || new Date().toISOString().split("T")[0];
    this.level = logEventLevel || LogEventLevel.verbose;
    this.outputDir = outputDir || "./logs";
    this.maxFileSize = maxFileSize || FileSize.ONE_MB * 10;
    this.content = [];
    this.newFile = true;
  }
  get fullname(): string {
    const extension = LogEventLevel[this.level];
    return `${this.name}-${extension}`;
  }

  get filePath(): string {
    return `${this.outputDir}/${this.fullname}.log`;
  }

  /**
   * Check if the file exists and if it's size is greater than the maxFileSize
   * If the file is too big, we roll it
   */
  async manageFiles(): Promise<void> {
    this.changeFileNameIfDateChanged();
    await this.checkFileExists();
    const fileStats = await fsp.stat(this.filePath);

    if (fileStats.size > this.maxFileSize) {
      await this.rollFile();
    }
  }

  countTodaysLogFiles(files: string[]): number {
    return files.filter(name => name.includes(this.fullname)).length;
  }

  /**
   * Roll the file by renaming it to include the number of files created today
   */
  async rollFile(): Promise<void> {
    try {
      const files = await fsp.readdir(this.outputDir);
      const todayFilesNumber = this.countTodaysLogFiles(files);

      await fsp.rename(this.filePath, `${this.filePath}.${todayFilesNumber}`);
    } catch (_error) {
      // File already renamed, we don't care
    } finally {
      await this.checkFileExists();
    }
  }

  /**
   * Check if the file exists and set the newFile flag accordingly
   */
  async checkFileExists() {
    try {
      await fsp.access(this.filePath, fs.constants.F_OK);
      this.newFile = false;
    } catch (_error) {
      await fsp.writeFile(this.filePath, "", { encoding: "utf-8" });
      this.newFile = true;
    }
  }

  /**
   * If the file name is a date and if it's different from today's date, we change it
   */
  changeFileNameIfDateChanged() {
    if (/\d{4}-\d{2}-\d{2}/.test(this.name)) {
      const [potentialNewFileName] = new Date().toISOString().split("T");

      if (potentialNewFileName !== this.name) {
        this.name = potentialNewFileName;
      }
    }
  }

  async emit(events: LogEvent[]): Promise<void> {
    if (this.level === LogEventLevel.off) return;

    await this.manageFiles();

    for (const event of events) {
      if (this.level === LogEventLevel.verbose || this.level === event.level) {
        this.content.push(`[${LogEventLevel[event.level]}] ${event.messageTemplate.render()}`);
      }
    }

    await this.flush();
  }

  async flush(): Promise<void> {
    await fsp.appendFile(this.filePath, `${this.newFile ? "" : "\n"}${this.content.join("\n")}`, {
      encoding: "utf-8"
    });

    this.content.length = 0;
  }
}
