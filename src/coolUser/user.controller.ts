import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query, HttpCode } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/config/jwt-auth.guard';
import { UpdateGoodUserDto } from './dto/update-user.dto';
import { CurrentUser } from './decorator/current-user.decorator';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @UseGuards(JwtAuthGuard)
  @Get('profile/:id')
  getCoolUserInfoById(@Param('id') id: string) {
    return this.userService.getInfoById(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('creators/my-follows')
  getMyFollowing(@CurrentUser() user: any) {
    const userId = user.id;
    return this.userService.getMyFollowing(+userId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('creators/follow/:id')
  userFollow(@Param('id') id: number, @CurrentUser() user: any) {
    return this.userService.userFollow(+id, +user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('creators/unfollow/:id')
  userUnfollow(@Param('id') id: number, @CurrentUser() user: any) {
    return this.userService.userUnfollow(+id, +user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('update/:id')
  updateGoodUser(@Param('id') id: string, @Body() updateUserDto: UpdateGoodUserDto) {
    return this.userService.updateGoodUser(+id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete/:id')
  deleteBadUser(@Param('id') id: string) {
    return this.userService.deleteBadUser(+id);
  }

  @Get('creators')
  getCreatorsInfoById() {
    return this.userService.getCreatorsInfo();
  }

  @Get('creator/:id')
  getCreatorInfoById(@Param('id') id: string) {
    return this.userService.getCreatorInfoById(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('creators/my-following/info')
  getFollowingCreatorsInfo(@CurrentUser() user: any) {
    return this.userService.getFollowingCreatorsInfo(+user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-favorite-events')
  async getMyFavoriteEvents(@CurrentUser() user: any) {
    const userId = user.id;
    return await this.userService.getMyFavoriteEvents(+userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-tickets')
  async getUserTickets(@CurrentUser() user: any) {
    const userId = user.id;
    console.log(userId)
    return this.userService.getUserTickets(+userId);
  }
}
