import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() body: { email: string; name?: string; role?: string }) {
    return this.userService.createUser(body.email, body.name, body.role);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  @Get()
  async findAll() {
    return this.userService.getAllUsers();
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { email?: string; name?: string },
  ) {
    return this.userService.updateUser(id, body.email, body.name);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }
}