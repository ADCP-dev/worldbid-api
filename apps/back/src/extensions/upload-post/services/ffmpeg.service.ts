import { Injectable, Logger } from '@nestjs/common';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  constructor(private readonly client: UploadPostClientService) {}

  async createJob(params: {
    fileUrl?: string;
    fileBuffer?: Buffer;
    filename?: string;
    fullCommand: string;
    outputExtension: string;
  }) {
    return this.client.createFfmpegJob(params);
  }

  async getJobStatus(jobId: string) {
    return this.client.getFfmpegJobStatus(jobId);
  }

  async getUsage() {
    return this.client.getFfmpegUsage();
  }

  // ─── Presets ──────────────────────────────────────────────────────────

  /** Convert any video to H.264 MP4 for social platforms. */
  async convertToSocialMp4(fileUrl: string) {
    return this.client.createFfmpegJob({
      fileUrl,
      fullCommand: 'ffmpeg -y -i {input} -c:v libx264 -crf 23 -c:a aac -b:a 128k {output}',
      outputExtension: 'mp4',
    });
  }

  /** Extract audio track to WAV. */
  async extractAudio(fileUrl: string) {
    return this.client.createFfmpegJob({
      fileUrl,
      fullCommand: 'ffmpeg -y -i {input} -vn -acodec pcm_s16le -ar 44100 {output}',
      outputExtension: 'wav',
    });
  }

  /** Crop vertical 9:16 for Reels/TikTok from a landscape video. */
  async cropVertical(fileUrl: string, x: number = 0, y: number = 0) {
    return this.client.createFfmpegJob({
      fileUrl,
      fullCommand: `ffmpeg -y -i {input} -vf "crop=1080:1920:${x}:${y},scale=1080:1920" -c:v libx264 -crf 23 -c:a aac {output}`,
      outputExtension: 'mp4',
    });
  }

  /** Burn subtitles into video using drawtext (multi-line with \\n). */
  async burnText(fileUrl: string, text: string, fontSize = 48) {
    const escaped = text.replace(/'/g, "\\'");
    return this.client.createFfmpegJob({
      fileUrl,
      fullCommand: `ffmpeg -y -i {input} -vf "drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=white:x=(w-text_w)/2:y=h-80:box=1:boxcolor=black@0.5:boxborderw=10" -c:v libx264 -crf 23 -c:a aac {output}`,
      outputExtension: 'mp4',
    });
  }

  /** Concatenate two videos via the FFmpeg concat filter. */
  async concatVideos(fileUrl1: string, fileUrl2: string) {
    // Upload-Post supports {input0} and {input1} placeholders.
    // fileUrl → {input0}, fileUrl1 param → {input1} (appended as 'file1' in FormData).
    return this.client.createFfmpegJob({
      fileUrl: fileUrl1,
      fileUrl1: fileUrl2,
      fullCommand: 'ffmpeg -y -i {input0} -i {input1} -filter_complex concat=n=2:v=1:a=1 {output}',
      outputExtension: 'mp4',
    });
  }
}