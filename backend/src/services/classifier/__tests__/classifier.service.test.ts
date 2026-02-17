/**
 * Classifier Service Tests (T3 + T4)
 *
 * Tests for ClassifierService in classifier.service.ts
 *
 * T3 - Error Categorization Tests:
 * 1. Timeout error → 'timeout'
 * 2. Rate limit error (429) → 'rate_limit'
 * 3. Parse/JSON error → 'parse_error'
 * 4. Generic API error → 'api_error'
 *
 * T4 - Metrics Recording Tests:
 * 1. Cache hit → increment classifierCacheHitsTotal, record latency with model='cache'
 * 2. Cache miss → increment classifierCacheMissesTotal
 * 3. AI success → record latency with model='openrouter', record request
 * 4. Keyword fallback → record latency with model='keyword-fallback', record request
 * 5. Error → increment classifierErrorsTotal with correct error_type
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClassifierService, resetClassifierService } from '../classifier.service.js';
import type { PrismaClient } from '@prisma/client';
import type { ClassificationResult } from '../types.js';

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics
vi.mock('../../../utils/metrics.js', () => ({
  classifierRequestsTotal: { inc: vi.fn() },
  classifierLatencySeconds: { observe: vi.fn() },
  classifierErrorsTotal: { inc: vi.fn() },
  classifierCacheHitsTotal: { inc: vi.fn() },
  classifierCacheMissesTotal: { inc: vi.fn() },
}));

// Mock OpenRouter client
vi.mock('../openrouter-client.js', () => ({
  classifyWithAI: vi.fn(),
}));

// Mock keyword classifier
vi.mock('../keyword-classifier.js', () => ({
  classifyByKeywords: vi.fn(),
}));

// Mock cache service
vi.mock('../cache.service.js', () => ({
  getCached: vi.fn(),
  setCache: vi.fn(),
  cleanupExpiredCache: vi.fn(),
  getCacheStats: vi.fn(),
}));

// Mock Prisma client
const mockPrisma = {} as PrismaClient;

describe('ClassifierService - Error Categorization (T3)', () => {
  let service: ClassifierService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetClassifierService();
    service = new ClassifierService(mockPrisma);
  });

  it('should categorize timeout error as "timeout"', async () => {
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { getCached } = await import('../cache.service.js');
    const { classifyByKeywords } = await import('../keyword-classifier.js');
    const { classifierErrorsTotal } = await import('../../../utils/metrics.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI failure with timeout error
    (classifyWithAI as any).mockRejectedValue(new Error('Request timed out after 30s'));

    // Mock keyword fallback
    (classifyByKeywords as any).mockReturnValue({
      classification: 'REQUEST',
      confidence: 0.6,
      model: 'keyword-fallback',
    });

    // Classify message (should use fallback)
    const result = await service.classifyMessage('test message');

    // Verify error was categorized as timeout
    expect(classifierErrorsTotal.inc).toHaveBeenCalledWith({ error_type: 'timeout' });
    expect(result.model).toBe('keyword-fallback');
  });

  it('should categorize rate limit error as "rate_limit"', async () => {
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { getCached } = await import('../cache.service.js');
    const { classifyByKeywords } = await import('../keyword-classifier.js');
    const { classifierErrorsTotal } = await import('../../../utils/metrics.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI failure with rate limit error
    (classifyWithAI as any).mockRejectedValue(new Error('Rate limit exceeded (429)'));

    // Mock keyword fallback
    (classifyByKeywords as any).mockReturnValue({
      classification: 'REQUEST',
      confidence: 0.6,
      model: 'keyword-fallback',
    });

    // Classify message
    await service.classifyMessage('test message');

    // Verify error was categorized as rate_limit
    expect(classifierErrorsTotal.inc).toHaveBeenCalledWith({ error_type: 'rate_limit' });
  });

  it('should categorize parse/JSON error as "parse_error"', async () => {
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { getCached } = await import('../cache.service.js');
    const { classifyByKeywords } = await import('../keyword-classifier.js');
    const { classifierErrorsTotal } = await import('../../../utils/metrics.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI failure with parse error
    (classifyWithAI as any).mockRejectedValue(new Error('Failed to parse JSON response'));

    // Mock keyword fallback
    (classifyByKeywords as any).mockReturnValue({
      classification: 'REQUEST',
      confidence: 0.6,
      model: 'keyword-fallback',
    });

    // Classify message
    await service.classifyMessage('test message');

    // Verify error was categorized as parse_error
    expect(classifierErrorsTotal.inc).toHaveBeenCalledWith({ error_type: 'parse_error' });
  });

  it('should categorize generic API error as "api_error"', async () => {
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { getCached } = await import('../cache.service.js');
    const { classifyByKeywords } = await import('../keyword-classifier.js');
    const { classifierErrorsTotal } = await import('../../../utils/metrics.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI failure with generic error
    (classifyWithAI as any).mockRejectedValue(new Error('Internal server error'));

    // Mock keyword fallback
    (classifyByKeywords as any).mockReturnValue({
      classification: 'REQUEST',
      confidence: 0.6,
      model: 'keyword-fallback',
    });

    // Classify message
    await service.classifyMessage('test message');

    // Verify error was categorized as api_error
    expect(classifierErrorsTotal.inc).toHaveBeenCalledWith({ error_type: 'api_error' });
  });
});

describe('ClassifierService - Metrics Recording (T4)', () => {
  let service: ClassifierService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetClassifierService();
    service = new ClassifierService(mockPrisma);
  });

  it('should record cache hit metrics with model="cache"', async () => {
    const { getCached } = await import('../cache.service.js');
    const { classifierCacheHitsTotal, classifierLatencySeconds, classifierRequestsTotal } =
      await import('../../../utils/metrics.js');

    // Mock cache hit
    const cachedResult: ClassificationResult = {
      classification: 'REQUEST',
      confidence: 0.95,
      model: 'cache',
    };
    (getCached as any).mockResolvedValue(cachedResult);

    // Classify message (should hit cache)
    const result = await service.classifyMessage('test message');

    // Verify cache hit metric
    expect(classifierCacheHitsTotal.inc).toHaveBeenCalled();

    // Verify latency recorded with model='cache'
    expect(classifierLatencySeconds.observe).toHaveBeenCalledWith(
      { model: 'cache' },
      expect.any(Number)
    );

    // Verify request recorded with model='cache'
    expect(classifierRequestsTotal.inc).toHaveBeenCalledWith({
      model: 'cache',
      classification: 'REQUEST',
    });

    expect(result.model).toBe('cache');
  });

  it('should record cache miss metrics', async () => {
    const { getCached } = await import('../cache.service.js');
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { classifierCacheMissesTotal } = await import('../../../utils/metrics.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI success
    (classifyWithAI as any).mockResolvedValue({
      classification: 'REQUEST',
      confidence: 0.92,
      model: 'openrouter',
    });

    // Classify message
    await service.classifyMessage('test message');

    // Verify cache miss metric
    expect(classifierCacheMissesTotal.inc).toHaveBeenCalled();
  });

  it('should record AI success metrics with model="openrouter"', async () => {
    const { getCached } = await import('../cache.service.js');
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { classifierLatencySeconds, classifierRequestsTotal } =
      await import('../../../utils/metrics.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI success
    const aiResult: ClassificationResult = {
      classification: 'SPAM',
      confidence: 0.88,
      model: 'openrouter',
    };
    (classifyWithAI as any).mockResolvedValue(aiResult);

    // Classify message
    const result = await service.classifyMessage('test message');

    // Verify latency recorded with model='openrouter'
    expect(classifierLatencySeconds.observe).toHaveBeenCalledWith(
      { model: 'openrouter' },
      expect.any(Number)
    );

    // Verify request recorded with model='openrouter'
    expect(classifierRequestsTotal.inc).toHaveBeenCalledWith({
      model: 'openrouter',
      classification: 'SPAM',
    });

    expect(result.model).toBe('openrouter');
  });

  it('should record keyword fallback metrics with model="keyword-fallback"', async () => {
    const { getCached } = await import('../cache.service.js');
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { classifyByKeywords } = await import('../keyword-classifier.js');
    const { classifierLatencySeconds, classifierRequestsTotal } =
      await import('../../../utils/metrics.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI failure
    (classifyWithAI as any).mockRejectedValue(new Error('AI service unavailable'));

    // Mock keyword fallback
    const keywordResult: ClassificationResult = {
      classification: 'GRATITUDE',
      confidence: 0.75,
      model: 'keyword-fallback',
    };
    (classifyByKeywords as any).mockReturnValue(keywordResult);

    // Classify message
    const result = await service.classifyMessage('test message');

    // Verify latency recorded with model='keyword-fallback'
    expect(classifierLatencySeconds.observe).toHaveBeenCalledWith(
      { model: 'keyword-fallback' },
      expect.any(Number)
    );

    // Verify request recorded with model='keyword-fallback'
    expect(classifierRequestsTotal.inc).toHaveBeenCalledWith({
      model: 'keyword-fallback',
      classification: 'GRATITUDE',
    });

    expect(result.model).toBe('keyword-fallback');
  });

  it('should record error metrics with correct error_type', async () => {
    const { getCached } = await import('../cache.service.js');
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { classifyByKeywords } = await import('../keyword-classifier.js');
    const { classifierErrorsTotal } = await import('../../../utils/metrics.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI failure with timeout
    (classifyWithAI as any).mockRejectedValue(new Error('Connection timeout'));

    // Mock keyword fallback
    (classifyByKeywords as any).mockReturnValue({
      classification: 'REQUEST',
      confidence: 0.6,
      model: 'keyword-fallback',
    });

    // Classify message
    await service.classifyMessage('test message');

    // Verify error metric recorded with error_type='timeout'
    expect(classifierErrorsTotal.inc).toHaveBeenCalledWith({ error_type: 'timeout' });
  });

  it('should record AI low-confidence fallback with correct metrics', async () => {
    const { getCached } = await import('../cache.service.js');
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { classifyByKeywords } = await import('../keyword-classifier.js');
    const { classifierLatencySeconds, classifierRequestsTotal } =
      await import('../../../utils/metrics.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI with low confidence (below threshold 0.7)
    const lowConfidenceAI: ClassificationResult = {
      classification: 'SPAM',
      confidence: 0.6, // Below default aiConfidenceThreshold (0.7)
      model: 'openrouter',
      reasoning: 'Low confidence',
    };
    (classifyWithAI as any).mockResolvedValue(lowConfidenceAI);

    // Mock keyword fallback with higher confidence
    const keywordResult: ClassificationResult = {
      classification: 'REQUEST',
      confidence: 0.65,
      model: 'keyword-fallback',
    };
    (classifyByKeywords as any).mockReturnValue(keywordResult);

    // Classify message
    const result = await service.classifyMessage('test message');

    // Should use keyword fallback (higher confidence than low-confidence AI)
    expect(result.model).toBe('keyword-fallback');

    // Verify fallback metrics recorded
    expect(classifierLatencySeconds.observe).toHaveBeenCalledWith(
      { model: 'keyword-fallback' },
      expect.any(Number)
    );

    expect(classifierRequestsTotal.inc).toHaveBeenCalledWith({
      model: 'keyword-fallback',
      classification: 'REQUEST',
    });
  });
});

describe('ClassifierService - Safety Net Integration (gh-131)', () => {
  let service: ClassifierService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetClassifierService();
    service = new ClassifierService(mockPrisma);
  });

  it('should default to CLARIFICATION when keyword result has confidence < 0.5 (threshold)', async () => {
    const { getCached } = await import('../cache.service.js');
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { classifyByKeywords } = await import('../keyword-classifier.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI failure
    (classifyWithAI as any).mockRejectedValue(new Error('AI service unavailable'));

    // Mock keyword result with low confidence (below keywordConfidenceThreshold 0.5)
    const lowConfidenceKeyword: ClassificationResult = {
      classification: 'REQUEST',
      confidence: 0.3, // Below default keywordConfidenceThreshold (0.5)
      model: 'keyword-fallback',
      reasoning: 'No patterns matched, requires human review',
    };
    (classifyByKeywords as any).mockReturnValue(lowConfidenceKeyword);

    // Classify message
    const result = await service.classifyMessage('test message');

    // Should default to CLARIFICATION with threshold confidence (0.5)
    expect(result).toMatchObject({
      classification: 'CLARIFICATION',
      confidence: 0.5,
      model: 'keyword-fallback',
      reasoning: 'Low confidence classification, defaulting to CLARIFICATION for manual review',
    });
  });

  it('should NOT default to CLARIFICATION when keyword result has confidence >= 0.5', async () => {
    const { getCached } = await import('../cache.service.js');
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { classifyByKeywords } = await import('../keyword-classifier.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI failure
    (classifyWithAI as any).mockRejectedValue(new Error('AI service unavailable'));

    // Mock keyword result with acceptable confidence (>= keywordConfidenceThreshold 0.5)
    const acceptableKeyword: ClassificationResult = {
      classification: 'SPAM',
      confidence: 0.7,
      model: 'keyword-fallback',
      reasoning: 'Matched SPAM patterns',
    };
    (classifyByKeywords as any).mockReturnValue(acceptableKeyword);

    // Classify message
    const result = await service.classifyMessage('test message');

    // Should keep original keyword result
    expect(result).toMatchObject({
      classification: 'SPAM',
      confidence: 0.7,
      model: 'keyword-fallback',
      reasoning: 'Matched SPAM patterns',
    });
  });

  it('should apply safety net when keyword classifier returns no-match default (confidence 0.3)', async () => {
    const { getCached } = await import('../cache.service.js');
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { classifyByKeywords } = await import('../keyword-classifier.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI failure
    (classifyWithAI as any).mockRejectedValue(new Error('AI service unavailable'));

    // Mock keyword result with default no-match confidence (0.3)
    const noMatchKeyword: ClassificationResult = {
      classification: 'CLARIFICATION',
      confidence: 0.3,
      model: 'keyword-fallback',
      reasoning: 'No patterns matched, requires human review',
    };
    (classifyByKeywords as any).mockReturnValue(noMatchKeyword);

    // Classify message
    const result = await service.classifyMessage('Random message with no patterns');

    // Should apply safety net and boost confidence to threshold
    expect(result).toMatchObject({
      classification: 'CLARIFICATION',
      confidence: 0.5, // Boosted to keywordConfidenceThreshold
      model: 'keyword-fallback',
      reasoning: 'Low confidence classification, defaulting to CLARIFICATION for manual review',
    });
  });

  it('should prefer AI low-confidence result over keyword low-confidence when AI is higher', async () => {
    const { getCached } = await import('../cache.service.js');
    const { classifyWithAI } = await import('../openrouter-client.js');
    const { classifyByKeywords } = await import('../keyword-classifier.js');

    // Mock cache miss
    (getCached as any).mockResolvedValue(null);

    // Mock AI with low confidence (below AI threshold 0.7 but above keyword threshold 0.5)
    const lowConfidenceAI: ClassificationResult = {
      classification: 'REQUEST',
      confidence: 0.55, // Below aiConfidenceThreshold (0.7) but above keywordConfidenceThreshold (0.5)
      model: 'openrouter',
      reasoning: 'AI low confidence',
    };
    (classifyWithAI as any).mockResolvedValue(lowConfidenceAI);

    // Mock keyword result with very low confidence
    const veryLowKeyword: ClassificationResult = {
      classification: 'CLARIFICATION',
      confidence: 0.3,
      model: 'keyword-fallback',
      reasoning: 'No patterns matched',
    };
    (classifyByKeywords as any).mockReturnValue(veryLowKeyword);

    // Classify message
    const result = await service.classifyMessage('test message');

    // Should use AI result (higher confidence than keyword)
    expect(result.classification).toBe('REQUEST');
    expect(result.confidence).toBe(0.55);
    expect(result.model).toBe('openrouter'); // Note: service might wrap this, check actual implementation
    expect(result.reasoning).toContain('AI (low confidence: 0.55)');
  });
});
