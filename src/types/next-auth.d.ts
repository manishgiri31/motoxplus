import { UserRole, StaffDepartment } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: UserRole;
    dealerId?: string;
    isSuperAdmin?: boolean;
    vendorId?: string;
    department?: StaffDepartment;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      dealerId?: string;
      isSuperAdmin?: boolean;
      vendorId?: string;
      department?: StaffDepartment;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    dealerId?: string;
    isSuperAdmin?: boolean;
    vendorId?: string;
    department?: StaffDepartment;
  }
}
