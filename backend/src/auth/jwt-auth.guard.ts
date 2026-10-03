import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Thin wrapper so controllers can write @UseGuards(JwtAuthGuard) for readability.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
