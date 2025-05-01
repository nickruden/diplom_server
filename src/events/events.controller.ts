import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from 'src/config/jwt-auth.guard';
import { CurrentUser } from 'src/user/decorator/current-user.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  getAllEvents() {
    return this.eventsService.getAllEvents();
  }

  @Get(':id')
  getEventById(@Param('id') id: string) {
    return this.eventsService.getEventById(+id);
  }

  @Get('/creator/:id')
  getEventByCreator(
    @Param('id') id: string,
    @Query('filter') filter?: 'upcoming' | 'past'
  ) {
    return this.eventsService.getEventsByCreator(+id, filter);
  }

  @Get('/category/:slug')
  getEventsByCategory(@Param('slug') slug: string) {
    return this.eventsService.getEventsByCategory(slug);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('/create')
  createEvent(@Body() eventData: CreateEventDto, @CurrentUser() user: any) {
    console.log(user.id, eventData)
    return this.eventsService.createEvent(eventData, +user.id);
  }

    @UseGuards(JwtAuthGuard)
    @Patch('/edit/:id')
    updateEvent(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
      return this.eventsService.updateEvent(+id, updateEventDto);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('delete/:id')
    delterUser(@Param('id') id: string, @CurrentUser() user: any) {
      return this.eventsService.delterEvent(+id, +user.id);
    }

  @UseGuards(JwtAuthGuard)
  @Delete('image/delete/:publicId')
  async deleteEventImage(@Param('publicId') publicId: string) {
    return this.eventsService.deleteImage(publicId);
  }

}