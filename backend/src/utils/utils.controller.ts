import { Controller, Get, Query } from '@nestjs/common';

@Controller('utils')
export class UtilsController {
  @Get('universities')
  async getUniversities(@Query('country') country: string) {
    if (!country) {
      return [];
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `http://universities.hipolabs.com/search?country=${encodeURIComponent(country)}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('University API error:', response.statusText);
        return [];
      }

      return await response.json();
    } catch (error: any) {
      console.warn('University API error:', error?.message || 'Unknown error');
      return [];
    }
  }
}
