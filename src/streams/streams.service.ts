import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreamsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStreams(limit = 20, cursor?: string) {
    let cursorCreatedAt: Date | undefined;
    let cursorId: string | undefined;

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [timeStr, id] = decoded.split('_');
        cursorCreatedAt = new Date(timeStr);
        cursorId = id;
        if (isNaN(cursorCreatedAt.getTime()) || !cursorId) {
          throw new Error('Invalid cursor');
        }
      } catch {
        throw new BadRequestException('Invalid pagination cursor');
      }
    }

    // Keyset pagination query with (createdAt, id) tie-breaker
    const streams = await this.prisma.stream.findMany({
      take: limit + 1,
      ...(cursorCreatedAt && cursorId
        ? {
            skip: 1,
            cursor: {
              id: cursorId,
            },
          }
        : {}),
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });

    const hasMore = streams.length > limit;
    const paginatedStreams = hasMore ? streams.slice(0, limit) : streams;

    let nextCursor: string | null = null;
    if (hasMore && paginatedStreams.length > 0) {
      const lastItem = paginatedStreams[paginatedStreams.length - 1];
      const rawCursor = `${lastItem.createdAt.toISOString()}_${lastItem.id}`;
      nextCursor = Buffer.from(rawCursor).toString('base64');
    }

    return {
      data: paginatedStreams,
      nextCursor,
    };
  }
}