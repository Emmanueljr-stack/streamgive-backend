import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // adjust path as needed

interface DonorRow {
  id: string;
  name: string;
  totalAmount: number | string;
}

@Injectable()
export class DonorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDonors(limit = 20, cursor?: string) {
    let cursorSortValue: number | undefined;
    let cursorId: string | undefined;

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [sortVal, id] = decoded.split('_');
        cursorSortValue = parseFloat(sortVal);
        cursorId = id;
        if (isNaN(cursorSortValue) || !cursorId) {
          throw new Error('Invalid cursor format');
        }
      } catch {
        throw new BadRequestException('Invalid pagination cursor');
      }
    }

    // Using Prisma raw query or optimized relation aggregation for keyset pagination
    // Example keyset logic: order by totalAmount DESC, id DESC
    const donors = await this.prisma.$queryRaw`
      SELECT 
        d.id, 
        d.name, 
        COALESCE(SUM(s.amount), 0) as "totalAmount"
      FROM "Donor" d
      LEFT JOIN "Stream" s ON s."donorId" = d.id
      GROUP BY d.id, d.name
      ${
        cursorSortValue !== undefined && cursorId !== undefined
          ? Prisma.sql`HAVING (COALESCE(SUM(s.amount), 0), d.id) < (${cursorSortValue},${cursorId})`
          : Prisma.empty
      }
      ORDER BY "totalAmount" DESC, d.id DESC
      LIMIT ${limit + 1}
    `;

    const hasMore = (donors as DonorRow[]).length > limit;
    const paginatedDonors = hasMore ? (donors as DonorRow[]).slice(0, limit) : (donors as DonorRow[]);

    let nextCursor: string | null = null;
    if (hasMore && paginatedDonors.length > 0) {
      const lastItem = paginatedDonors[paginatedDonors.length - 1];
      const rawCursorString = `${lastItem.totalAmount}_${lastItem.id}`;
      nextCursor = Buffer.from(rawCursorString).toString('base64');
    }

    return {
      data: paginatedDonors,
      nextCursor,
    };
  }
}