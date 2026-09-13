import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(@UploadedFile() file: any) {
    return this.uploadImage(file);
  }

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, MP4, WebM, MOV.');
    }

    const isVideo = file.mimetype.startsWith('video/');
    const maxSize = isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024; // 50MB video, 8MB image
    if (file.size > maxSize) {
      throw new BadRequestException(`File size exceeds ${isVideo ? '50MB' : '8MB'} limit`);
    }

    const filename = this.uploadService.generateUniqueFilename(file.originalname);

    try {
      const imageUrl = await this.uploadService.uploadFile(file.buffer, filename, file.mimetype);

      // Locked-media blur preview (images only — videos keep the icon tile).
      let previewUrl: string | null = null;
      if (!isVideo) {
        try {
          const prefix = filename.replace(/\.[^.]+$/, '');
          previewUrl = await this.uploadService.createBlurredPreview(file.buffer, prefix);
        } catch (previewError: any) {
          console.error('Blurred preview generation failed (continuing):', previewError?.message);
        }
      }

      return {
        url: imageUrl,
        previewUrl,
        filename,
        type: isVideo ? 'video' : 'image',
      };
    } catch (error: any) {
      console.error('Upload controller error:', error);
      throw new BadRequestException(error.message || 'Failed to upload image');
    }
  }
}
