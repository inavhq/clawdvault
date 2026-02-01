import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Lazy initialization to avoid build-time errors
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    // Check for DATABASE_URL at runtime
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

// Export a getter function
export const db = () => getPrismaClient();

// Fee configuration (basis points)
export const FEE_CONFIG = {
  TOTAL_BPS: 100,      // 1% total fee
  PROTOCOL_BPS: 30,    // 0.3% to protocol
  CREATOR_BPS: 50,     // 0.5% to creator  
  REFERRER_BPS: 20,    // 0.2% to referrer (if exists)
};

// Calculate fee breakdown
export function calculateFees(solAmount: number, hasReferrer: boolean) {
  const totalFee = (solAmount * FEE_CONFIG.TOTAL_BPS) / 10000;
  
  if (hasReferrer) {
    return {
      total: totalFee,
      protocol: (solAmount * FEE_CONFIG.PROTOCOL_BPS) / 10000,
      creator: (solAmount * FEE_CONFIG.CREATOR_BPS) / 10000,
      referrer: (solAmount * FEE_CONFIG.REFERRER_BPS) / 10000,
    };
  } else {
    // No referrer - split referrer fee between protocol and creator
    return {
      total: totalFee,
      protocol: (solAmount * (FEE_CONFIG.PROTOCOL_BPS + 10)) / 10000, // 0.4%
      creator: (solAmount * (FEE_CONFIG.CREATOR_BPS + 10)) / 10000,   // 0.6%
      referrer: 0,
    };
  }
}

// Constants
export const INITIAL_VIRTUAL_SOL = 30;
export const INITIAL_VIRTUAL_TOKENS = 1073000000;
export const GRADUATION_THRESHOLD_SOL = 85;
