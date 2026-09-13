import { Controller, Post, Get, Put, Body, Param, Query } from '@nestjs/common';
import { SaveOfferService } from './save-offer.service';

@Controller('save-offers')
export class SaveOfferController {
  constructor(private saveOfferService: SaveOfferService) {}

  @Post('offer')
  async offerToSave(@Body() offerData: any) {
    console.log('[SaveOfferController] Creating save offer');
    return this.saveOfferService.offerToSaveConversation(offerData);
  }

  @Put(':offerId/respond')
  async respondToOffer(
    @Param('offerId') offerId: string,
    @Body() body: { response: 'accepted' | 'declined' },
    @Query('userId') userId?: string,
    @Query('guestId') guestId?: string,
  ) {
    console.log('[SaveOfferController] Responding to offer:', offerId, body.response);
    return this.saveOfferService.respondToSaveOffer(offerId, body.response, userId, guestId);
  }

  @Get('pending')
  async getPendingOffers(@Query('userId') userId?: string, @Query('guestId') guestId?: string) {
    console.log('[SaveOfferController] Getting pending offers');
    return this.saveOfferService.getPendingOffers(userId, guestId);
  }

  @Get('reconnectable')
  async getReconnectableConversations(@Query('userId') userId?: string, @Query('guestId') guestId?: string) {
    console.log('[SaveOfferController] Getting reconnectable conversations');
    return this.saveOfferService.getReconnectableConversations(userId, guestId);
  }
}