import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

@Injectable()
export class UploadService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async uploadFile(file: Buffer, filename: string, contentType: string): Promise<string> {
    const bucket = process.env.SUPABASE_BUCKET || 'ChatMoo';

    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .upload(filename, file, {
          contentType,
          upsert: false,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from(bucket)
        .getPublicUrl(filename);

      return publicUrl;
    } catch (error: any) {
      console.error('Upload error:', error);
      throw new Error('Failed to upload file');
    }
  }

  generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const extension = originalName.split('.').pop();
    return `${timestamp}-${random}.${extension}`;
  }

  // Generates a heavily blurred, low-resolution JPEG copy of an image and
  // uploads it separately. Used as the preview for paid/locked media so the
  // full-res URL can stay hidden until a recipient unlocks it.
  async createBlurredPreview(file: Buffer, prefix: string): Promise<string> {
    const processed = await sharp(file, { animated: false })
      .resize({ width: 420, height: 420, fit: 'inside', withoutEnlargement: true })
      .blur(12)
      .jpeg({ quality: 45 })
      .toBuffer();

    const filename = `${prefix}-blur.jpg`;
    return this.uploadFile(processed, filename, 'image/jpeg');
  }

  async deleteFile(filename: string): Promise<void> {
    const bucket = process.env.SUPABASE_BUCKET || 'ChatMoo';

    try {
      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([filename]);

      if (error) {
        console.error('Supabase delete error:', error);
        throw new Error(`Failed to delete file: ${error.message}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      throw new Error('Failed to delete file');
    }
  }
}
