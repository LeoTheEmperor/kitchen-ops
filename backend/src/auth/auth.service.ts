import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { StaffService } from '../staff/staff.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly staffService: StaffService,
    private readonly jwtService: JwtService,
  ) {}

  // No public signup: staff accounts are created by an ADMIN via StaffController (3).
  async login(email: string, password: string) {
    const staff = await this.staffService.findByEmail(email);
    if (!staff || !staff.active || !(await bcrypt.compare(password, staff.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildToken(staff.id, staff.email, staff.role, staff.name);
  }

  private buildToken(sub: string, email: string, role: string, name: string) {
    const access_token = this.jwtService.sign({ sub, email, role, name });
    return { access_token };
  }
}
