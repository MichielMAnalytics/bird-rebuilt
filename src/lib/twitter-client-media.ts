import * as fs from 'node:fs';
import * as path from 'node:path';
import { TwitterClientBase } from './twitter-client-base.js';
import { UPLOAD_API_BASE } from './twitter-client-constants.js';

type Constructor<T = {}> = new (...args: any[]) => T;

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export function MediaMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async uploadMedia(filePath: string, mimeType: string): Promise<string> {
      const absolutePath = path.resolve(filePath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
      }

      const fileData = fs.readFileSync(absolutePath);
      const totalBytes = fileData.length;

      // Step 1: INIT
      const initParams = new URLSearchParams({
        command: 'INIT',
        total_bytes: totalBytes.toString(),
        media_type: mimeType,
      });

      const initHeaders = {
        ...this.getHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      const initResponse = await this.fetchWithTimeout(UPLOAD_API_BASE, {
        method: 'POST',
        headers: initHeaders,
        body: initParams.toString(),
      });

      if (!initResponse.ok) {
        const text = await initResponse.text().catch(() => '');
        throw new Error(`Failed to initialize media upload: HTTP ${initResponse.status} ${text.substring(0, 200)}`);
      }

      const initData: any = await initResponse.json();
      const mediaId = initData.media_id_string;
      if (!mediaId) {
        throw new Error('Failed to initialize media upload: no media_id returned');
      }

      // Step 2: APPEND (chunked)
      let segmentIndex = 0;
      for (let offset = 0; offset < totalBytes; offset += CHUNK_SIZE) {
        const chunk = fileData.subarray(offset, offset + CHUNK_SIZE);
        const base64Chunk = chunk.toString('base64');

        const boundary = `----FormBoundary${Date.now()}`;
        const parts: string[] = [];

        parts.push(`--${boundary}`);
        parts.push('Content-Disposition: form-data; name="command"');
        parts.push('');
        parts.push('APPEND');

        parts.push(`--${boundary}`);
        parts.push('Content-Disposition: form-data; name="media_id"');
        parts.push('');
        parts.push(mediaId);

        parts.push(`--${boundary}`);
        parts.push('Content-Disposition: form-data; name="segment_index"');
        parts.push('');
        parts.push(segmentIndex.toString());

        parts.push(`--${boundary}`);
        parts.push('Content-Disposition: form-data; name="media_data"');
        parts.push('');
        parts.push(base64Chunk);

        parts.push(`--${boundary}--`);

        const body = parts.join('\r\n');

        const appendHeaders = {
          ...this.getHeaders(),
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        };

        const appendResponse = await this.fetchWithTimeout(UPLOAD_API_BASE, {
          method: 'POST',
          headers: appendHeaders,
          body,
        });

        if (!appendResponse.ok && appendResponse.status !== 204) {
          const text = await appendResponse.text().catch(() => '');
          throw new Error(
            `Failed to append media chunk ${segmentIndex}: HTTP ${appendResponse.status} ${text.substring(0, 500)}`
          );
        }

        segmentIndex++;
      }

      // Step 3: FINALIZE
      const finalizeParams = new URLSearchParams({
        command: 'FINALIZE',
        media_id: mediaId,
      });

      const finalizeHeaders = {
        ...this.getHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      const finalizeResponse = await this.fetchWithTimeout(UPLOAD_API_BASE, {
        method: 'POST',
        headers: finalizeHeaders,
        body: finalizeParams.toString(),
      });

      if (!finalizeResponse.ok) {
        const text = await finalizeResponse.text().catch(() => '');
        throw new Error(`Failed to finalize media upload: HTTP ${finalizeResponse.status} ${text.substring(0, 200)}`);
      }

      const finalizeData: any = await finalizeResponse.json();

      // Check for async processing (video)
      if (finalizeData.processing_info) {
        await this.waitForProcessing(mediaId);
      }

      return mediaId;
    }

    async waitForProcessing(mediaId: string): Promise<void> {
      const checkUrl = `${UPLOAD_API_BASE}?command=STATUS&media_id=${mediaId}`;
      const maxAttempts = 30;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const statusResponse = await this.fetchWithTimeout(checkUrl, {
          method: 'GET',
          headers: this.getHeaders(),
        });

        if (!statusResponse.ok) {
          throw new Error(`Media status check failed: HTTP ${statusResponse.status}`);
        }

        const statusData: any = await statusResponse.json();
        const state = statusData.processing_info?.state;
        if (state === 'succeeded') return;
        if (state === 'failed') {
          const error = statusData.processing_info?.error;
          throw new Error(
            `Media processing failed: ${error?.message ?? 'unknown error'}`
          );
        }

        const waitSeconds = statusData.processing_info?.check_after_secs ?? 2;
        await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
      }

      throw new Error('Media processing timed out');
    }
  };
}
