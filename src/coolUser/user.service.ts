import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { UpdateGoodUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) { }

  async getInfoById(id: number) {

    const user = await this.prisma.users.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        email: true,
        password: false,
        phone: true,
        firstName: true,
        lastName: true,
        avatar: true,
        organizerName: true,
        organizerDesc: true,
        organizerMedias: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) return null;

    const eventsCount = await this.prisma.events.count({
      where: {
        organizerId: id,
      },
    });

    const followersCount = await this.prisma.userFollower.count({
      where: {
        userId: id,
      },
    });

    return {
      ...user,
      eventsCount,
      followersCount,
    };
  }

  async updateGoodUser(id: number, dto: UpdateGoodUserDto) {
    const updateUser = await this.prisma.users.update({
      where: { id: id },
      data: {
        ...dto,
      },
    });

    const user = await this.getInfoById(updateUser.id);
    return user;
  }

  async delterBadUser(id: number) {
    const deltedUser = await this.prisma.users.delete({
      where: { id: id },
    });

    return deltedUser;
  }

  async getCreatorsInfo() {
    // Получаем всех пользователей с основной информацией
    const users = await this.prisma.users.findMany({
      select: {
        id: true,
        avatar: true,
        organizerName: true,
        organizerDesc: true,
        organizerMedias: true,
      },
    });

    if (!users || users.length === 0) {
      throw new Error('Пользователи не найдены');
    }

    // Получаем ID всех пользователей для запросов подсчета
    const userIds = users.map(user => user.id);

    // Получаем количество подписчиков для каждого пользователя
    const followersCounts = await this.prisma.userFollower.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds }
      },
      _count: {
        _all: true
      },
    });

    // Формируем массив с информацией о пользователях и количестве подписчиков
    const usersWithCounts = users.map(user => ({
      ...user,
      followersCount: followersCounts.find(f => f.userId === user.id)?._count._all || 0,
    }));

    // Сортируем по количеству подписчиков (по убыванию)
    const sortedUsers = usersWithCounts.sort((a, b) => b.followersCount - a.followersCount);

    return sortedUsers;
  }

  async getCreatorInfoById(id: number) {
    if (!id) {
      throw new Error('ID организатора обязателен');
    }

    const user = await this.prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        avatar: true,
        organizerName: true,
        organizerDesc: true,
        organizerMedias: true,
      },
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // Получаем количество подписчиков (кто подписан на этого пользователя)
    const followersCount = await this.prisma.userFollower.count({
      where: { userId: id },
    });

    // Получаем количество организованных событий
    const eventsCount = await this.prisma.events.count({
      where: { organizerId: id },
    });

    return {
      id: user.id,
      avatar: user.avatar,
      creatorName: user.organizerName,
      creatorDesc: user.organizerDesc,
      creatorMedias: user.organizerMedias,
      followersCount,
      eventsCount,
    };
  }

  async getMyFollowing(userId: number) {
    const followings = await this.prisma.userFollower.findMany({
      where: { followerId: userId },
      select: {
        userId: true,
      },
    });
  
    return followings.map(f => f.userId);
  }

  async userFollow(id: number, userId: number) {
    const follow = await this.prisma.userFollower.create({
      data: {
        followerId: userId,
        userId: id,
      },
      select: {
        userId: true,
      },
    });
  
    return follow.userId;
  }
  
  async userUnfollow(id: number, userId: number) {
    await this.prisma.userFollower.deleteMany({
      where: {
        followerId: userId,
        userId: id,
      },
    });
  
    return id;
  }

  async getFollowingCreatorsInfo(userId: number) {
    const followingOrganizers = await this.prisma.userFollower.findMany({
      where: { followerId: userId },
      select: { userId: true },
    });
  
    const organizerIds = followingOrganizers.map(follow => follow.userId);
  
    const users = await this.prisma.users.findMany({
      where: { id: { in: organizerIds } },
      select: {
        id: true,
        avatar: true,
        organizerName: true,
        organizerDesc: true,
        organizerMedias: true,
      },
    });
  
    if (!users || users.length === 0) {
      throw new Error('Подписки не найдены');
    }
  
    // Получаем количество подписчиков для каждого пользователя
    const followersCounts = await this.prisma.userFollower.groupBy({
      by: ['userId'],
      where: {
        userId: { in: organizerIds },
      },
      _count: {
        _all: true,
      },
    });
  
    // Формируем массив с информацией о пользователях и количестве подписчиков
    const usersWithCounts = users.map(user => ({
      ...user,
      followersCount: followersCounts.find(f => f.userId === user.id)?._count._all || 0,
    }));
  
    // Сортируем по количеству подписчиков (по убыванию)
    return usersWithCounts.sort((a, b) => b.followersCount - a.followersCount);
  }  
}
