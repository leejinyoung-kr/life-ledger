import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  // Google 로그인 시 user upsert 후 JWT 발급
  async login(googleUser: GoogleUser): Promise<string> {
    const user = await this.prisma.user.upsert({
      where: { google_id: googleUser.googleId },
      update: {
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      },
      create: {
        google_id: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      },
    });

    return this.jwtService.sign({
      sub: user.id,
      googleId: user.google_id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    });
  }
}
