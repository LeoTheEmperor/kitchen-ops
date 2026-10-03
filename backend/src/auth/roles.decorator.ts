import { SetMetadata } from '@nestjs/common';
import { StaffRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
// Usage: @Roles(StaffRole.ADMIN, StaffRole.DISPATCH) above a controller/method.
// Adding a new role later only ever means adding it to the relevant @Roles(...)
// calls - no scattered string checks anywhere else in the codebase (section 3).
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);
